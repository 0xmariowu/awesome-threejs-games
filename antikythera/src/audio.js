// audio.js
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const VOICE_HARD = 96;
const VOICE_SOFT = 64;
const OSC_CAP = 40;
const MAX_LYRE = 16;
const SNAP_RATE = 6;
const SR_GEN = 48000;

const MIX = { master: 0.9, amb: 0.8, sfx: 1, sting: 0.85, music: 0.3, ui: 0.6, reverb: 0.55 };

const LV = {
  air: 0.32, water: 0.26, nightBell: 1.1, gull: 0.8, lap: 1, creak: 1, snap: 0.8, fish: 1, splash: 0.395, breach: 0.9, drips: 0.45, breath: 0.2, sonar: 0.125, echo: 0.58, scan: 0.55, reveal: 0.7, pickup: 0.5, tick: 0.82,
  crack: 0.9, pour: 0.5, brush: 0.4, clack: 0.62, swell: 1, wrong: 0.5, crank: 0.76, glyph: 0.8, ui: 1.25, sunrise: 0.5,
  helmetAir: 0.085,
  dolphin: 0.63, fishLeap: 0.45,
  foot: 0.35, kneel: 0.225, stow: 0.7, gather: 0.5, rail: 0.6, slap: 0.5, plop: 0.25, under: 0.25, release: 0.2, valve: 0.5, land: 0.28,
  beacon: 0.4, pulse: 0.2, hero: 0.66, align: 0.65, slot: 0.8, saros: 1.15, ratchet: 1.15, teeth: 0.42, mesh: 0.5, ost: 0.9,
  eclipse: 1.8, ring: 0.7, rise: 2.2, heart: 0.028, rig: 0.7, fizz: 0.5, school: 0.6, sperm: 0.6, breachMusic: 1.1,
};

const MODES = {
  title: { air: 1, water: 0, variant: 'deck', sfxCut: 18000, musicCut: 18000, revCut: 7000, sfxSend: 0.05, ambSend: 0.04, room: 0 },
  surface: { air: 1, water: 0, variant: 'sea', sfxCut: 18000, musicCut: 18000, revCut: 7000, sfxSend: 0.05, ambSend: 0.04, room: 0 },
  underwater: { air: 0, water: 1, variant: null, sfxCut: 2200, musicCut: 1500, revCut: 2000, sfxSend: 0.06, ambSend: 0.05, room: 1 },
};
const NEAR_CLOSE = 5500;
const MUSIC_CLOSE = 4500;
const WIDTH_WATER = 0.6;

const MOTIF_BELL = [74, 81, 84, 83, 81];
const MOTIF_LYRE = [62, 69, 72, 71, 69];
const MOTIF_BASS = [50, 57, 60, 59, 57];
const WHEEL_F1 = [261.63, 440, 293.66];
const WHEEL_BELL = [84, 81, 74];
const WHEEL_MODES = [[1, 1], [1.73, 0.5], [2.33, 0.3], [3.91, 0.12], [4.11, 0.09]];
const WHEEL_LEN = 1.5;
const TOOTH_RATE = [0.86, 1.12, 0.94];
const TOOTH_GAIN = [1.6, 1.2, 1.55];
const WHEEL_GAIN = [1.1, 1.37, 1.15];
const WHEEL_PHASE = [31, 858, 31];


const DORIAN = [2, 4, 5, 7, 9, 11, 0];
const D_MAJ_PENTA = [2, 4, 6, 9, 11];

const CHORDS = {
  Dm: { pcs: [2, 5, 9], pad: [50, 57, 62, 65], bass: 50 },
  C: { pcs: [0, 4, 7], pad: [48, 55, 60, 64], bass: 48 },
  G: { pcs: [7, 11, 2], pad: [43, 55, 59, 62], bass: 43 },
  F: { pcs: [5, 9, 0], pad: [41, 53, 57, 60], bass: 41 },
  CoD: { pcs: [0, 4, 7], pad: [50, 55, 60, 64], bass: 50 },
  GoD: { pcs: [7, 11, 2], pad: [50, 55, 59, 62], bass: 50 },
  AmoD: { pcs: [9, 0, 4], pad: [50, 57, 60, 64], bass: 50 },
  Dsus2: { pcs: [2, 4, 9], pad: [50, 57, 62, 64], bass: 50 },
  D: { pcs: [2, 6, 9], pad: [50, 57, 62, 66], bass: 50 },
  A: { pcs: [9, 1, 4], pad: [45, 57, 61, 64], bass: 45 },
  Bm: { pcs: [11, 2, 6], pad: [47, 54, 59, 62], bass: 47 },
};

const PHRASES = [
  [[0, 0, 0.6], [4, 1, 0.45], [8, 2, 0.5]],
  [[0, 2, 0.55], [6, 1, 0.4], [12, 0, 0.45]],
  [[0, 1, 0.5], [4, 3, 0.5], [10, 2, 0.4]],
  [[0, 4, 0.5], [6, 3, 0.4], [8, 2, 0.45], [14, 1, 0.35]],
  [[0, 0, 0.5], [8, 3, 0.5]],
];
const END_INTRO = [[0, 0, 0.5], [8, 3, 0.55]];
const ARP8R = [[0, -1, 2, 1, -1, 3, 2, -1], [0, 2, -1, 3, -1, 2, 1, -1]];
const CRANK8A = [0, 2, 1, 2, 0, 3, 1, 3];

const STAGES = {
  title: { bpm: 60, vol: 1, prog: ['Dm', 'Dm', 'C', 'C', 'G', 'G', 'Dm', 'Dm'], lyre: 'phrase', phraseProb: 0.55,
    lo: 62, decay: 1.4, passing: 0.08, bass: 0.35, pad: 0.42, drone: 0.4, pulse: 0, shimmer: 0.08, cut: 1000, scale: DORIAN },
  explore: { bpm: 54, vol: 0.68, prog: ['Dm', 'Dm', 'GoD', 'GoD', 'CoD', 'CoD', 'Dm', 'AmoD'], lyre: 'sparse', noteProb: 0.15, gap: 8,
    lo: 62, decay: 1.6, passing: 0.1, bass: 0, pad: 0.3, drone: 0.55, pulse: 0, shimmer: 0.03, cut: 800, scale: DORIAN, fadeIn: true },
  assemble: { bpm: 72, vol: 0.8, prog: ['Dm', 'F', 'C', 'G'], lyre: 'arp8r', arpKeep: 0.4, lo: 62, decay: 0.9, passing: 0, bass: 0.3,
    pad: 0.5, drone: 0.4, pulse: 0, shimmer: 0.12, cut: 1500, scale: DORIAN },
  crank: { bpm: 84, vol: 0.8, prog: ['Dm'], lyre: 'none', lo: 62, decay: 0.6, passing: 0, bass: 0,
    pad: 0, drone: 0.55, pulse: 1, shimmer: 0, cut: 900, scale: DORIAN },
  eclipse: { bpm: 60, prog: ['Dsus2'], lyre: 'none', lo: 74, decay: 2.2, passing: 0, bass: 0, pad: 0.25, drone: 0.9,
    pulse: 0, shimmer: 0, cut: 650, scale: DORIAN },
  end: { bpm: 60, vol: 1.5, prog: ['D', 'G', 'D', 'A', 'Bm', 'G', 'D', 'D'], lyre: 'phrase', phraseProb: 0.3, intro: true,
    lo: 62, decay: 1.5, passing: 0.06, bass: 0.35, pad: 0.44, drone: 0.4, pulse: 0, shimmer: 0.15, cut: 3000, scale: D_MAJ_PENTA,
    ison: [0.5, 0.8, 1.3, 1] },
};

const REVEALS = [
  { bells: [[74, 0, 0.36, -0.2], [81, 0.42, 0.28, 0.25]], choir: null, sparkle: [], low: 38, lyre: [] },
  { bells: [[74, 0, 0.36, -0.2], [81, 0.36, 0.3, 0.2], [84, 0.72, 0.26, 0]], choir: [50, 57], vowel: 'oh',
    sparkle: [81, 86], low: 38, lyre: [] },
  { bells: [[74, 0, 0.3, -0.25], [81, 0.45, 0.26, 0.25]], choir: [50, 57, 62, 64], vowel: 'ah', sparkle: [81, 86, 88], low: 38,
    boom: true, lyre: [[74, 0, 0.62], [81, 0.45, 0.62], [84, 0.9, 0.66], [83, 1.15, 0.6], [81, 1.4, 0.7]] },
];
const VOWELS = { ah: [730, 1090, 2440], oh: [570, 840, 2410], oo: [300, 870, 2240] };
const LUNAR = [69, 71, 74, 76, 77, 81];
const SOLAR = [74, 76, 81, 83, 86];
const CONS = [3, 4, 5, 7, 8, 9, 12, 15, 16, 19, 24];
const SPARKLE = [86, 88, 93, 98, 100];
const ECHO_F = 880;
const ECL_VOICES = [[38, 0.9], [45, 0.7], [50, 0.8], [57, 0.6], [62, 0.5], [69, 0.35]];
const CRANK_HARM = [[0.25, ['Dm']], [0.5, ['Dm', 'GoD']], [0.75, ['CoD', 'GoD']], [0.94, ['AmoD', 'A7s4']], [1.01, ['A7s4']]];
const PAD_V = { Dm: [50, 57, 62, 65], GoD: [50, 55, 59, 62], CoD: [50, 55, 60, 64], AmoD: [50, 57, 60, 64], A7s4: [45, 57, 62, 67], D5: [38, 50, 57, 62] };
const RISE_CH = [[0, [38, 45, 50, 53, 57]], [0.45, [41, 48, 53, 57, 60]], [0.65, [38, 50, 55, 59, 62]], [0.75, [38, 50, 55, 60, 64]], [0.85, [45, 50, 52, 55, 57]]];
const RISE_S1 = [[62, 0.8], [69, 0.8], [72, 0.4], [71, 0.4], [69, 1.2]];
const RISE_S2 = [[65, 0.8], [72, 0.8], [75, 0.4], [74, 0.4], [72, 1.2]];
const RISE_OPEN = [38, 45, 50, 57, 62];
const DAWN = [[-11, [55, 59, 62, 67], 62], [-9, null, 69], [-7, null, 72], [-5, [45, 57, 62, 67], 71], [-3.5, null, 69],
  [-2.5, [45, 55, 61, 64], 73], [-2, null, 71], [-1.5, null, 69]];
const EL_RIM = -1;
const DAWN_RISE = { 0: [38, 43, 50, 55, 59], 3: [45, 50, 52, 55, 57], 5: [45, 52, 55, 61, 64] };
const SUN_RES_RISE = [38, 45, 50, 54, 57];

const SUN_CHORDS = [[50, 57, 64, 65], [50, 55, 59, 62], [50, 57, 60, 64], [45, 57, 61, 64]];
const SUN_RES = [50, 57, 62, 66];
const SUN_PHRASES = [
  [[57, 0.7], [62, 0.7], [64, 1.5]],
  [[65, 0.5], [64, 0.5], [62, 0.5], [59, 0.55], [62, 1.1]],
  [[64, 0.45], [67, 0.45], [69, 0.45], [72, 1.5]],
  [[71, 0.6], [69, 0.6], [67, 0.45], [69, 0.55], [73, 1.2]],
];
const SUN_FINAL = 74;

const LYRE_PANS = [-0.55, -0.25, 0, 0.25, 0.55];
const SNAP_PANS = [-0.9, -0.6, -0.35, -0.1, 0.1, 0.35, 0.6, 0.9];
const SNAP_GAINS = [0.5, 0.8, 0.35, 1, 0.6, 0.9, 0.4, 0.7];
const RATCHET_PANS = [-0.25, -0.08, 0.08, 0.25];
const RATCHET_GAINS = [0.85, 1, 0.9, 0.8];

const BELL_F0 = 440;
const BELL_PARTIALS = [
  [0.5, 0.42, 6.0], [0.5028, 0.12, 5.2], [1.0, 0.75, 4.4], [1.0024, 0.3, 4.0], [1.194, 0.42, 3.2], [1.506, 0.24, 2.6],
  [2.0, 0.42, 1.9], [2.0019, 0.16, 1.7], [2.514, 0.15, 1.1], [2.662, 0.1, 0.95], [3.011, 0.09, 0.7], [4.166, 0.04, 0.4],
  [5.43, 0.02, 0.25], [6.79, 0.012, 0.16],
];
const DROP_SLOT = 0.25;
const DROP_N = 12;
const CLINK_SLOT = 0.5;
const CLINK_N = 5;
const THUNK_SLOT = 1.6;
const THUNK_N = 3;

const SCAN_BAKE = 1.1;
const ECHO_BAKE = 1.1;
const ECHO_FAR = (ECHO_BAKE - 0.2) / 2.3;
const CLACK_I = 0.75;
const CLACK_HP = 0.75;
const REVEAL_BAKES = ['reveal0', 'reveal1', 'reveal2'];
const BAKES = [
  ['splash', 3.4, 2, 0, 'sfx', true, (e) => e.splash(1)],
  ['breath', 4.8, 3, 32000, 'breath', false, (e) => e.breathe()],
  ['sonar', 3.4, 2, 32000, 'sfx', false, (e) => e.sonar()],
  ['echo', 4.8, 3, 32000, 'sfx', false, (e) => e.echo(ECHO_BAKE)],
  ['scan', 1.5, 2, 32000, 'sfx', false, (e) => e.scan(SCAN_BAKE)],
  ['pickup', 3.8, 2, 32000, 'sfx', false, (e) => e.pickup()],
  ['pour', 4.2, 2, 32000, 'sfx', false, (e) => e.sandPour(1.4)],
  ['reveal0', 8.5, 1, 32000, 'sting', true, (e) => e._revealMusic(0)],
  ['reveal1', 8.5, 1, 32000, 'sting', true, (e) => e._revealMusic(1)],
  ['reveal2', 9, 1, 32000, 'sting', true, (e) => e._revealMusic(2)],
  ['pourS', 2.6, 2, 32000, 'sfx', false, (e) => e.sandPour(0.8)],
  ['swellIn', 5.4, 1, 32000, 'music', true, (e) => e._swellIntro(e._ctx.currentTime + 0.03, LV.swell, e._musicBus)],
  ['clack', 0.9, 3, 32000, 'sfx', false, (e) => e.clack(CLACK_I, 1)],
  ['clackH', 2.1, 2, 32000, 'sfx', false, (e) => e.clack(1, CLACK_HP)],
  ['wrong', 1.5, 3, 32000, 'sfx', false, (e) => e.wrong()],
  ['hero2', 1.4, 2, 32000, 'sfx', false, (e) => e._heroCore(2)],
  ['hero1', 1.4, 2, 32000, 'sfx', false, (e) => e._heroCore(1)],
  ['hero0', 1.4, 2, 32000, 'sfx', false, (e) => e._heroCore(0)],
  ['breach', 4.8, 1, 0, 'sfx', true, (e) => e.surfaceBreach()],
  ['drips', 7.6, 1, 0, 'sfx', true, (e) => e.drips()],
  ['ring', 7.2, 1, 0, 'sting', true, (e) => e._ringChord()],
];

let WRONG_K = 0;

const idle = () => new Promise((res) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => res(), { timeout: 150 });
  else setTimeout(res, 16);
});

function audibleEnd(d) {
  for (let i = d.length - 1; i >= 0; i--) if (d[i] > 1e-4 || d[i] < -1e-4) return Math.min(d.length, i + 256);
  return 0;
}


const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp$1 = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const smooth = (x) => x * x * (3 - 2 * x);
const pc = (m) => ((m % 12) + 12) % 12;
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const quiet = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };
const lerpV = (a, b, x) => a.map((v, i) => v + (b[i] - v) * x);

function drop(...nodes) {
  for (const n of nodes) {
    try { if (n) n.disconnect(); } catch (e) {  }
  }
}

function hold(param, t) {
  if (typeof param.cancelAndHoldAtTime === 'function') { param.cancelAndHoldAtTime(t); return; }
  const v = param.value;
  param.cancelScheduledValues(t);
  param.setValueAtTime(v, t);
}

function setp(param, v, t, tc) {
  param.cancelScheduledValues(t);
  param.setTargetAtTime(v, t, tc);
}

function scaleStep(m, scale, dir) {
  for (let k = 1; k <= 3; k++) if (scale.includes(pc(m + k * dir))) return m + k * dir;
  return m;
}


function normalize(d, peak) {
  let m = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > m) m = a; }
  const k = peak / (m || 1);
  for (let i = 0; i < d.length; i++) d[i] *= k;
}

function seeded(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fadeTail(d, sr, sec) {
  const n = Math.min(d.length, Math.floor(sec * sr));
  for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
}

function addMode(d, sr, i0, f, a, t60, phase = 0) {
  if (f <= 0 || f >= sr * 0.48) return;
  const n = Math.min(d.length - i0, Math.ceil(t60 * sr * 1.05));
  const w = (2 * Math.PI * f) / sr;
  const r = Math.exp(-6.907755 / (t60 * sr));
  const c = r * Math.cos(w);
  const s = r * Math.sin(w);
  let x = Math.cos(phase) * a;
  let y = Math.sin(phase) * a;
  for (let i = 0; i < n; i++) {
    d[i0 + i] += y;
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
  }
}

function genNoise(sr, seconds, color) {
  const len = Math.floor(seconds * sr);
  const fade = Math.floor(0.08 * sr);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last;
      } else raw[i] = w;
    }
    const d = new Float32Array(len);
    for (let i = 0; i < len; i++) d[i] = raw[i];
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      d[i] = raw[i] * Math.sqrt(a) + raw[len + i] * Math.sqrt(1 - a);
    }
    let mean = 0;
    for (let i = 0; i < len; i++) mean += d[i];
    mean /= len;
    for (let i = 0; i < len; i++) d[i] -= mean;
    normalize(d, 0.9);
    out.push(d);
  }
  return out;
}

function genImpulse(sr, seconds) {
  const len = Math.floor(seconds * sr);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(len);
    const t60 = ch ? 2.3 : 2.1;
    const pre = Math.floor((ch ? 0.014 : 0.01) * sr);
    const dk = Math.exp(-6.9 / sr / t60);
    const ck = Math.pow(0.12, 1 / (len - pre));
    let lp = 0;
    let env = 1;
    let c = 0.6;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      lp += c * (Math.random() * 2 - 1 - lp);
      d[i] = lp * env * (x > 0.88 ? (1 - x) / 0.12 : 1);
      env *= dk;
      c *= ck;
    }
    (ch ? [0.019, 0.031, 0.043, 0.067] : [0.015, 0.026, 0.039, 0.061]).forEach((s, k) => {
      const i = Math.floor(s * sr);
      if (i < len) d[i] += (k % 2 ? -1 : 1) * (0.22 - 0.035 * k);
    });
    out.push(d);
  }
  return out;
}

function genClick(sr) {
  const len = Math.max(8, Math.floor(0.004 * sr));
  const d = new Float32Array(len);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.0007 * sr));
  d[0] = 0.9;
  return d;
}

function genClickPad(sr) {
  const len = Math.floor(0.025 * sr);
  const d = new Float32Array(len);
  const n = Math.floor(0.0015 * sr);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.00025 * sr));
  d[0] = 0.85;
  return d;
}

function genRatchet(sr) {
  const len = Math.floor(0.045 * sr);
  const d = new Float32Array(len);
  const modes = [[430, 0.009, 0.55], [980, 0.006, 0.5], [1650, 0.0035, 0.25]];
  const rnd = seeded(11);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    lp += 0.22 * ((rnd() * 2 - 1) - lp);
    lp2 += 0.22 * (lp - lp2);
    let v = lp2 * 2.6 * Math.exp(-t / 0.0015);
    for (const [f, tau, a] of modes) v += a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t);
    d[i] = v * Math.min(1, i / 8) * Math.min(1, (len - i) / (0.006 * sr));
  }
  normalize(d, 0.9);
  return d;
}

function genTooth(sr) {
  const d = new Float32Array(Math.floor(0.05 * sr));
  const rnd = seeded(7);
  let lp = 0, lp2 = 0;
  const nk = Math.floor(0.006 * sr);
  for (let i = 0; i < nk; i++) {
    lp += 0.18 * ((rnd() * 2 - 1) - lp);
    lp2 += 0.18 * (lp - lp2);
    d[i] += lp2 * 2.4 * Math.exp(-i / (0.0012 * sr)) * Math.min(1, i / 6);
  }
  [[640, 0.5, 0.022], [1080, 0.28, 0.014], [330, 0.3, 0.03]].forEach(([f, a, t60]) => addMode(d, sr, 3, f, a, t60));
  fadeTail(d, sr, 0.008);
  normalize(d, 0.9);
  return d;
}

function genGrit(sr, seconds, rate = 260, chans = 2) {
  const len = Math.floor(seconds * sr);
  const out = [];
  for (let ch = 0; ch < chans; ch++) {
    const d = new Float32Array(len);
    const end = len - Math.floor(0.004 * sr);
    let t = 0;
    for (;;) {
      t += -Math.log(1 - Math.random()) / rate;
      const i0 = Math.floor(t * sr);
      if (i0 >= end) break;
      const a = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? -1 : 1);
      const n = Math.max(2, Math.floor((0.0002 + Math.random() * 0.0008) * sr));
      for (let i = 0; i < n; i++) d[i0 + i] += a * (Math.random() * 2 - 1) * (1 - i / n);
    }
    let prev = 0;
    for (let i = 0; i < len; i++) { const x = d[i]; d[i] = x - 0.6 * prev; prev = x; }
    normalize(d, 0.9);
    out.push(d);
  }
  return out;
}

function genBell(sr) {
  const d = new Float32Array(Math.floor(5.5 * sr));
  for (const [r, a, t60] of BELL_PARTIALS) addMode(d, sr, 0, BELL_F0 * r, a, t60, Math.random() * 0.3);
  let lp = 0;
  const n = Math.floor(0.004 * sr);
  for (let i = 0; i < n; i++) {
    lp += 0.5 * (Math.random() * 2 - 1 - lp);
    d[i] += lp * 0.35 * Math.exp(-i / (0.0008 * sr));
  }
  fadeTail(d, sr, 0.4);
  normalize(d, 0.9);
  return d;
}

function genBubbles(sr, seconds) {
  const len = Math.floor(seconds * sr);
  const out = [];
  const lo = Math.log(170);
  const span = Math.log(2600) - lo;
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(len);
    const ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
    let t = 0.002;
    for (;;) {
      const b = 0.5 + 0.5 * (0.5 * Math.sin(t * 4.4 + ph[0]) + 0.3 * Math.sin(t * 8.2 + ph[1]) + 0.2 * Math.sin(t * 17.9 + ph[2]));
      t += -Math.log(1 - Math.random()) / (30 + 150 * b * b);
      if (t > seconds - 0.08) break;
      const f0 = Math.exp(lo + Math.pow(Math.random(), 1.5) * span);
      const amp = (0.35 + 0.65 * Math.random()) * Math.pow(420 / f0, 0.3);
      const tau = (0.0035 + Math.random() * 0.009) * Math.pow(500 / f0, 0.45) * (1 + Math.max(0, 350 / f0 - 0.5));
      const rise = 0.15 + Math.random() * 0.5;
      const i0 = Math.floor(t * sr);
      const n = Math.min(Math.floor(6 * tau * sr), len - i0);
      const dm = Math.exp(-1 / (tau * sr));
      const am = Math.exp(-1 / (0.0004 * sr));
      let env = 1;
      let atk = 1;
      let phase = 0;
      for (let i = 0; i < n; i++) {
        phase += (2 * Math.PI * f0 * (1 + (rise * i) / n)) / sr;
        d[i0 + i] += amp * (1 - atk) * env * Math.sin(phase);
        env *= dm;
        atk *= am;
      }
    }
    normalize(d, 0.9);
    out.push(d);
  }
  return out;
}

function genDrops(sr) {
  const slot = Math.floor(DROP_SLOT * sr);
  const d = new Float32Array(slot * DROP_N);
  for (let k = 0; k < DROP_N; k++) {
    const seg = new Float32Array(slot);
    const nSub = 1 + ((Math.random() * 3) | 0);
    let i0 = 16;
    for (let j = 0; j < nSub; j++) {
      const amp = j === 0 ? 1 : 0.35 + 0.4 * Math.random();
      const fc = 900 + 2100 * Math.random();
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      const tau = (0.0008 + 0.0022 * Math.random()) * sr;
      const n = Math.floor(tau * 6);
      let lp = 0, lp2 = 0;
      for (let i = 0; i < n && i0 + i < slot; i++) {
        lp += a * (Math.random() * 2 - 1 - lp);
        lp2 += a * (lp - lp2);
        seg[i0 + i] += amp * 2.2 * lp2 * Math.exp(-i / tau) * Math.min(1, i / 6);
      }
      if (j === 0 && Math.random() < 0.3) {
        const f0 = 300 + 450 * Math.random();
        const nr = Math.floor((0.015 + 0.015 * Math.random()) * sr);
        const dl = Math.floor((0.001 + 0.003 * Math.random()) * sr);
        let ph = 0;
        for (let i = 0; i < nr && i0 + dl + i < slot; i++) {
          ph += (2 * Math.PI * f0 * (1 + 0.15 * (i / nr))) / sr;
          seg[i0 + dl + i] += 0.12 * Math.sin(ph) * Math.exp(-i / (nr / 4)) * Math.min(1, i / 30);
        }
      }
      i0 += Math.floor((0.004 + 0.022 * Math.random()) * sr);
    }
    fadeTail(seg, sr, 0.02);
    normalize(seg, 0.9);
    d.set(seg, k * slot);
  }
  return d;
}

function genClinks(sr) {
  const slot = Math.floor(CLINK_SLOT * sr);
  const d = new Float32Array(slot * CLINK_N);
  const ratios = [1, 1.594, 2.136, 2.653, 3.156];
  for (let k = 0; k < CLINK_N; k++) {
    const seg = new Float32Array(slot);
    const f0 = 560 * (0.85 + 0.3 * Math.random());
    const wood = 180 + 80 * Math.random();
    const hit = (i0, amp, damp) => {
      const nk = Math.floor(0.006 * sr);
      let lp = 0, lp2 = 0;
      for (let i = 0; i < nk && i0 + i < slot; i++) {
        lp += 0.16 * (Math.random() * 2 - 1 - lp);
        lp2 += 0.16 * (lp - lp2);
        seg[i0 + i] += amp * 3 * lp2 * Math.exp(-i / (0.0018 * sr));
      }
      addMode(seg, sr, i0, f0 * 0.5 * (0.97 + 0.06 * Math.random()), amp * 0.9, damp * 0.09);
      ratios.forEach((r, j) => addMode(seg, sr, i0, f0 * r * (0.98 + 0.04 * Math.random()),
        amp * (0.4 + 0.3 * Math.random()) * Math.pow(j + 1, -1.2), damp * (0.06 + 0.06 * Math.random()) * Math.pow(j + 1, -0.8)));
      addMode(seg, sr, i0, wood, amp * 0.35, 0.05);
    };
    hit(8, 1, 1);
    if (k >= 2) hit(Math.floor((0.03 + 0.04 * Math.random()) * sr), 0.3, 0.7);
    if (k >= 3) hit(Math.floor((0.09 + 0.05 * Math.random()) * sr), 0.12, 0.5);
    fadeTail(seg, sr, 0.05);
    normalize(seg, 0.9);
    d.set(seg, k * slot);
  }
  return d;
}

function genThunks(sr) {
  const slot = Math.floor(THUNK_SLOT * sr);
  const d = new Float32Array(slot * THUNK_N);
  for (let k = 0; k < THUNK_N; k++) {
    const seg = new Float32Array(slot);
    let ph = 0;
    const nT = Math.floor(0.3 * sr);
    for (let i = 0; i < nT; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * (70 + 40 * Math.exp(-t / 0.03))) / sr;
      seg[i] += 0.28 * Math.exp(-t / 0.05) * Math.sin(ph) * Math.min(1, i / 24);
    }
    let lp = 0, lp2 = 0;
    const nK = Math.floor(0.1 * sr);
    for (let i = 0; i < nK; i++) {
      lp += 0.1 * (Math.random() * 2 - 1 - lp);
      lp2 += 0.1 * (lp - lp2);
      seg[i] += lp2 * 4 * Math.exp(-i / (0.02 * sr));
    }
    const f0 = 220 * (0.87 + 0.26 * Math.random());
    [1, 1.62, 2.21, 2.73, 3.3].forEach((r, j) => addMode(seg, sr, 0, f0 * r * (0.98 + 0.04 * Math.random()),
      0.6 * Math.pow(j + 1, -0.8) * (0.6 + 0.4 * Math.random()), 0.3 * Math.pow(j + 1, -0.7)));
    addMode(seg, sr, 0, 160 + 60 * Math.random(), 0.3, 0.07);
    addMode(seg, sr, 0, 420 + 100 * Math.random(), 0.12, 0.035);
    [[0.035 + 0.02 * Math.random(), 0.16], [0.09 + 0.03 * Math.random(), 0.07]].forEach(([dt, a]) => {
      const fr = 650 * (0.9 + 0.2 * Math.random());
      [1, 1.59].forEach((r, j) => addMode(seg, sr, Math.floor(dt * sr), fr * r, a * Math.pow(j + 1, -0.8), 0.04));
    });
    fadeTail(seg, sr, 0.2);
    normalize(seg, 0.95);
    d.set(seg, k * slot);
  }
  return d;
}

function genWheels(sr) {
  const out = {};
  WHEEL_F1.forEach((f1, w) => {
    const d = new Float32Array(Math.floor(WHEEL_LEN * sr));
    const ph = seeded(WHEEL_PHASE[w]);
    for (const [r, a] of WHEEL_MODES) {
      const t60 = Math.max(0.05, 0.35 * Math.pow(r, -1.3));
      const p = ph() * 2 * Math.PI;
      addMode(d, sr, 0, f1 * r * 0.9985, a * 0.5, t60, p);
      addMode(d, sr, 0, f1 * r * 1.0015, a * 0.5, t60 * 0.94, p);
    }
    const rnd = seeded(13 + w);
    let lp = 0, lp2 = 0;
    const n = Math.floor(0.012 * sr);
    for (let i = 0; i < n; i++) {
      lp += 0.12 * (rnd() * 2 - 1 - lp);
      lp2 += 0.12 * (lp - lp2);
      d[i] += lp2 * 3.2 * Math.exp(-i / (0.0025 * sr)) * Math.min(1, i / 8);
    }
    for (let i = 0; i < 24; i++) d[i] *= i / 24;
    fadeTail(d, sr, 0.2);
    normalize(d, 0.9);
    out['wheel' + w] = [d];
  });
  return out;
}

const GEN_LATE = { bubbles: (sr) => genBubbles(sr, 3), thunks: (sr) => [genThunks(sr)], bell: (sr) => [genBell(sr)] };

function genAll(sr, light = false) {
  const D = {
    white: genNoise(sr, 2, 'white'), pink: genNoise(sr, 4, 'pink'), brown: genNoise(sr, 5, 'brown'),
    click: [genClick(sr)], clickPad: [genClickPad(sr)], ratchet: [genRatchet(sr)], tooth: [genTooth(sr)], grit: genGrit(sr, 2),
    grit2: genGrit(sr, 2, 1100, 1),
    drops: [genDrops(sr)], clinks: [genClinks(sr)], ...genWheels(sr),
  };
  if (!light) for (const k of Object.keys(GEN_LATE)) D[k] = GEN_LATE[k](sr);
  return D;
}

function makeSoftClip() {
  const n = 4097;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    c[i] = ax < 0.75 ? x : Math.sign(x) * (0.75 + 0.14 * Math.tanh((ax - 0.75) / 0.14));
  }
  return c;
}


class AudioEngine {
  constructor(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    this._opts = o;
    this._ctx = null;
    this._ready = false;
    this._failed = false;
    this._starting = null;
    this._timer = 0;
    this._offline = false;
    this._volume = 1;
    this._muted = false;
    this._mode = null;
    this._modeOn = null;
    this._stageReq = null;
    this._night = 0;
    this._nightSet = -1;
    this._visSuspended = false;
    this._unlockArmed = false;
    this._autoOff = null;
    this._stage = 'off';
    this._pending = null;
    this._nextStep = 0;
    this._step = 0;
    this._bar = 0;
    this._stageT0 = 0;
    this._phrase = null;
    this._arp = null;
    this._lastChord = '';
    this._lyreVoices = 0;
    this._ladders = new Map();
    this._sparseEcho = null;
    this._voices = 0;
    this._oscs = 0;
    this._persist = 0;
    this._errors = 0;
    this._lastError = '';
    this._lastTick = -1;
    this._lastCrack = -1;
    this._lastClack = -1;
    this._lastHover = -1;
    this._tickPan = 0.15;
    this._lastGlyph = -1;
    this._glyphT = 0;
    this._glyphMidi = 74;
    this._glyphIdx = 2;
    this._breathBusy = 0;
    this._exhaleT = 0;
    this._lastAirWarn = -1;
    this._lastDud = -1;
    this._crank = 0;
    this._eclA = 0;
    this._eclIdle = 0;
    this._ecl = null;
    this._cueDone = false;
    this._airBed = null;
    this._waterBed = null;
    this._brushL = null;
    this._crankL = null;
    this._swell = null;
    this._cue = null;
    this._crickets = null;
    this._helmetL = null;
    this._pod = null;
    this._swellPre = null;
    this._revealed = 0;
    this._lis = { dH: 99, depth: 0, close: 0, dW: 50, tPrev: -1, dPrev: 0, vUp: 0, setAt: -1, pH: -1, cl: -1, dly: -1, u: -1, air: 1 };
    this._plume = false;
    this._lastFoot = -1;
    this._footF = [];
    this._lastSlap = -1;
    this._lastLyre = -1;
    this._lyreQuiet = 0;
    this._heroN = 0;
    this._heroSeated = [];
    this._asmLyre = true;
    this._pulse0 = 0;
    this._rise = null;
    this._eclL = null;
    this._heart = null;
    this._endAt = 0;
    this._endPend = false;
    this._rockQ = [];
    this._brushDuckT = -1;
    this._preRoll = null;
    this._baked = {};
    this._bakeBytes = 0;
    this._bakeOn = false;
    this._onVis = this._onVis.bind(this);
    this._data = null;
    try { this._data = genAll(SR_GEN, true); } catch (e) { this._data = null; }
    this._genLate();
    if (o.autoStart !== false && !o.context) this._armAutoStart();
  }

  async _genLate() {
    for (const k of Object.keys(GEN_LATE)) {
      await idle();
      const D = this._data;
      if (!D) return;
      if (!D[k]) { try { D[k] = GEN_LATE[k](SR_GEN); } catch (e) {  } }
    }
  }


  async start() {
    if (this._failed) return;
    if (this._autoOff) { this._autoOff(); this._autoOff = null; }
    if (this._ready) { this._resume(); return; }
    if (!this._starting) this._starting = this._boot();
    await this._starting;
  }

  setMode(mode) {
    if (!has(MODES, mode)) return;
    this._mode = mode;
    if (mode === this._modeOn) return;
    this._run(() => {
      const prev = this._modeOn;
      const M = MODES[mode];
      const t = this._ctx.currentTime;
      this._modeOn = mode;
      const fromWater = prev === 'underwater';
      if (M.air) this._ensureAirBed(M.variant);
      if (M.air && fromWater) this._airOpen(t);
      if (M.water) this._ensureWaterBed();
      setp(this._airBus.gain, M.air, t, M.air ? (fromWater ? 0.1 : 0.45) : 0.03);
      setp(this._waterBus.gain, M.water, t, M.water ? 0.1 : 0.03);
      this._nearTo(t, M.water ? 0.04 : 0.03, 0.3);
      setp(this._revLP.frequency, M.revCut, t, 0.3);
      setp(this._sfxSend.gain, M.sfxSend, t, 0.3);
      setp(this._ambSend.gain, M.ambSend, t, 0.3);
      setp(this._roomIn.gain, M.room, t, 0.05);
      this._widthTo(M.water ? WIDTH_WATER : 1, t, M.water ? 0.1 : 0.3);
      setp(this._plungeLP.frequency, M.water ? 16000 : 400, t, 0.04);
      setp(this._plungeG.gain, M.water ? 1 : 0.1, t, 0.04);
      setp(this._breathBus.gain, M.water ? 1 : 0, t, 0.06);
      if (M.water) this._helmetOn(t);
      else this._helmetOff(t);
      if (M.water && prev && prev !== 'underwater' && this._plungeAt && t - this._plungeAt < 3 && !this._baking) this._lensSwirl(t + 0.005);
      if (!M.water) {
        if (this._brushL) this._brushTo(0, t);
        if (this._crankL) { this._crank = 0; this._crankTo(0, t); }
        if (this._swell) this._swellEnd(t, true);
        this._plume = false;
        this._heartOff(t);
        if (this._preRoll) { const P = this._preRoll; this._preRoll = null; setp(P.g.gain, 0, t, 0.02); }
      }
    });
  }

  _nearTo(t, tc, tcM = tc) {
    const M = MODES[this._modeOn] || MODES.title;
    const w = !!M.water;
    const c = this._lis.close;
    setp(this._sfxLP.frequency, w && c ? NEAR_CLOSE : M.sfxCut, t, tc);
    setp(this._sfxShelf.gain, w && !c ? -6 : 0, t, tc);
    setp(this._sfxPeak.gain, w ? 2 : 0, t, tc);
    const R = this._rise;
    const mc = !w ? M.musicCut : R && R.u > 0 ? M.musicCut + (9000 - M.musicCut) * Math.pow(R.u, 1.2) : c ? MUSIC_CLOSE : M.musicCut;
    setp(this._musicLP.frequency, mc, t, tcM);
  }

  _widthTo(w, t, tc) {
    const a = (1 + w) / 2, b = (1 - w) / 2;
    for (const g of this._wA) setp(g.gain, a, t, tc);
    for (const g of this._wB) setp(g.gain, b, t, tc);
  }

  setMusic(stage) {
    if (stage !== 'off' && !has(STAGES, stage)) return;
    if (!this._ready) { if (!this._failed) this._stageReq = stage; return; }
    this._run(() => {
      const now = this._ctx.currentTime;
      if (this._swell && stage !== 'assemble') this._swellEnd(now, false);
      if (this._swellPre && stage !== 'assemble' && stage !== 'explore') { this._retire(this._swellPre, now + 0.1); this._swellPre = null; }
      if (stage !== 'explore') this._heartOff(now);
      if (stage === 'eclipse') this._riseStart(now);
      if (stage !== 'end') { this._endAt = 0; this._endPend = false; }
      if (stage === 'off') {
        this._pending = null;
        this._endAt = 0;
        if (this._stage !== 'off') { this._stage = 'off'; setp(this._scoreGain.gain, 0, now, 1.2); }
        return;
      }
      if (stage === 'end' && this._stage !== 'end') {
        const Q = this._cue;
        if (Q && !Q.resolved) { this._endPend = true; this._pending = null; return; }
        const at = Q && Q.resolvedAt ? Q.resolvedAt + 9 : now + 4;
        if (at > now + 0.05) { this._endAt = at; this._pending = null; return; }
      }
      if (stage === this._stage) { this._pending = null; return; }
      if (stage === this._pending) return;
      if (this._stage === 'off') { this._nextStep = now + 0.06; this._step = 0; }
      this._pending = stage;
    });
  }

  setNight(k) {
    this._night = clamp$1(num(k, this._night), 0, 1);
    this._run(() => this._applyNight());
  }

  toggleMute() {
    this._muted = !this._muted;
    this._applyMaster();
    return this._muted;
  }

  setMasterVolume(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    this._volume = clamp$1(num(n, this._volume), 0, 1);
    this._applyMaster();
  }

  stats() {
    const c = this._ctx;
    return {
      state: c ? c.state : 'none', ready: this._ready, failed: this._failed, time: c ? +c.currentTime.toFixed(2) : 0,
      mode: this._modeOn, music: this._stage, pending: this._pending, night: this._night,
      voices: this._voices, oscillators: this._oscs, persistent: this._persist,
      layers: {
        air: !!this._airBed, water: !!this._waterBed, brush: !!this._brushL, crank: !!this._crankL,
        swell: !!this._swell, sunrise: !!this._cue, eclipse: !!this._eclL, rise: !!this._rise, helmet: !!this._helmetL,
        heart: !!this._heart,
      },
      listen: { pH: +this._lis.pH.toFixed(2), close: this._lis.close, depth: +this._lis.depth.toFixed(1), u: this._rise ? +this._rise.u.toFixed(2) : null },
      errors: this._errors, lastError: this._lastError,
      baked: Object.keys(this._baked).filter((k) => this._baked[k]).join(' '), bakedMB: +(this._bakeBytes / 1048576).toFixed(1),
    };
  }


  splash(s) {
    const S = clamp$1(num(s, 1), 0.3, 1.6);
    this._plungeS = S;
    this._plungeAt = this._ctx ? this._ctx.currentTime : 0;
    this._splashImpAt = this._plungeAt;
    if (this._baked1('splash', Math.pow(S, 0.55))) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.005;
      const L = 1.5 * LV.splash * Math.pow(S, 0.55);
      const sl = 0.7 + 0.3 * S;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.14, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const w = this._noise(this._buf.pink);
      const e0 = this._env(t, 0.9 * L, 0.0008, 0.014, out);
      const lp0 = this._f('lowpass', 1300, 0.5, e0);
      const hp0 = this._f('highpass', 90, 0.5, lp0);
      this._whump(t, 420, 150, 0.12, 2.1 * L, 0.003, 0.075, out, G);
      const e1 = this._env(t + 0.001, 0.85 * L, 0.002, 0.075, out);
      const lp1 = this._f('lowpass', 1100, 0.5, e1);
      lp1.frequency.setValueAtTime(1100, t);
      lp1.frequency.exponentialRampToValueAtTime(380, t + 0.3);
      w.connect(hp0);
      w.connect(lp1);
      this._fire(w, t, t + 2.6, [lp0, hp0, e0, lp1, e1], undefined, G);
      const r = this._noise(this._buf.pink);
      const e2 = this._g(0, out);
      e2.gain.setValueAtTime(0, t + 0.01);
      e2.gain.linearRampToValueAtTime(0.62 * L, t + 0.04);
      e2.gain.setTargetAtTime(0, t + 0.07, 0.3 * sl);
      const lp2 = this._f('lowpass', 950, 0.5, e2);
      lp2.frequency.setValueAtTime(950, t + 0.01);
      lp2.frequency.exponentialRampToValueAtTime(520, t + 0.9);
      const hp2 = this._f('highpass', 110, 0.5, lp2);
      r.connect(hp2);
      const gr = this._noise(this._buf.grit);
      const e2b = this._env(t + 0.02, 0.3 * L, 0.04, 0.35 * sl, out);
      const lp2b = this._f('lowpass', 800, 0.5, e2b);
      gr.connect(lp2b);
      this._fire(r, t, t + 2.6, [lp2, hp2, e2], undefined, G);
      this._fire(gr, t, t + 2.6, [lp2b, e2b], undefined, G);
      const bw = this._nb(t + 0.01, 340, 0.8, 0.55 * L * sl, 0.012, 0.13 * sl, out, G, { buf: this._buf.pink, hold: 0.04 });
      if (bw) { bw.frequency.setValueAtTime(340, t + 0.01); bw.frequency.exponentialRampToValueAtTime(140, t + 0.3); }
      const cr = this._nb(t + 0.18, 700, 0.5, 0.36 * L, 0.12, 0.35 * sl, out, G, { buf: this._buf.pink, hold: 0.08, type: 'lowpass' });
      if (cr) { cr.frequency.setValueAtTime(900, t + 0.18); cr.frequency.exponentialRampToValueAtTime(380, t + 0.8); }
      const dl = this._f('lowpass', 1300, 0.5, out);
      const nd = Math.round(14 + 10 * S);
      for (let k = 0; k < nd; k++) this._drop(t + 0.22 + 1.6 * Math.pow(Math.random(), 1.5), rand(0.5, 0.72), rand(0.13, 0.28) * L, rand(-0.7, 0.7), dl, G);
      G.shared.push(dl);
      this._seal(G);
    });
  }

  splashBody(s) {
    const S = clamp$1(num(s, 1), 0.3, 1.6);
    const now = this._ctx ? this._ctx.currentTime : 0;
    if (!(this._splashImpAt >= 0) || now - this._splashImpAt > 1.5) { this.splash(S); }
    this._plungeS = S;
    this._plungeAt = now;
    this._run(() => {
      const t = this._ctx.currentTime + 0.005;
      const L = LV.splash * Math.pow(S, 0.55);
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.1, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      this._whump(t, 360, 110, 0.25, 1.63 * L, 0.006, 0.1, out, G);
      const bw = this._nb(t + 0.004, 300, 0.8, 0.46 * L, 0.01, 0.12, out, G, { buf: this._buf.pink, hold: 0.03 });
      if (bw) { bw.frequency.setValueAtTime(300, t + 0.004); bw.frequency.exponentialRampToValueAtTime(140, t + 0.2); }
      const gl = this._nb(t + 0.06, 300, 0.9, 0.48 * L, 0.018, 0.06, out, G, { buf: this._buf.brown, hold: 0.03 });
      if (gl) {
        gl.frequency.setValueAtTime(300, t + 0.06);
        gl.frequency.exponentialRampToValueAtTime(140, t + 0.15);
        gl.frequency.exponentialRampToValueAtTime(210, t + 0.28);
      }
      this._seal(G);
    });
  }

  surfaceBreach() {
    if (!this._baking) {
      this._run(() => {
        const now = this._ctx.currentTime;
        const P = this._preRoll;
        if (P) { this._preRoll = null; setp(P.g.gain, 0, now, 0.02); }
        this._breachMusic(now);
      });
    }
    if (this._baked1('breach')) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.005;
      const tb = t;
      const L = LV.breach;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.06, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const w = this._noise(this._buf.white);
      const e1 = this._env(tb, 0.64 * L, 0.001, 0.018, out);
      const hp1 = this._f('highpass', 800, 0.7, e1);
      w.connect(hp1);
      this._nb(tb + 0.004, 520, 0.8, 0.36 * L, 0.008, 0.09, out, G, { buf: this._buf.pink });
      this._nb(tb, 1800, 0.35, 0.34 * L, 0.002, 0.03, out, G, { buf: this._buf.pink, hold: 0.012 });
      this._whump(tb + 0.002, 380, 150, 0.05, 0.9 * L, 0.003, 0.05, out, G);
      const e2 = this._env(tb, 0.85 * L, 0.005, 0.1, out);
      const bp2 = this._f('bandpass', 1500, 0.7, e2);
      const e3 = this._g(0, out);
      e3.gain.setValueAtTime(0, tb);
      e3.gain.linearRampToValueAtTime(0.4 * L, tb + 0.05);
      e3.gain.setValueAtTime(0.4 * L, tb + 0.35);
      e3.gain.setTargetAtTime(0, tb + 0.35, 0.35);
      const bp3 = this._f('bandpass', 2600, 0.6, e3);
      w.connect(bp2);
      w.connect(bp3);
      this._fire(w, tb, tb + 3.2, [hp1, e1, bp2, e2, bp3, e3], undefined, G);
      const g = this._noise(this._buf.grit);
      const e4 = this._g(0, out);
      e4.gain.setValueAtTime(0, tb);
      e4.gain.linearRampToValueAtTime(0.5 * L, tb + 0.04);
      e4.gain.setValueAtTime(0.5 * L, tb + 0.4);
      e4.gain.setTargetAtTime(0, tb + 0.4, 0.4);
      const bp4 = this._f('bandpass', 2000, 0.6, e4);
      g.connect(bp4);
      this._fire(g, tb, tb + 3.4, [bp4, e4], undefined, G);
      const dl = this._f('lowpass', 1600, 0.5, out);
      for (let k = 0; k < 14; k++) {
        this._drop(tb + 0.08 + 1.3 * Math.pow(Math.random(), 1.4), rand(0.55, 0.85), rand(0.14, 0.32) * L, rand(-0.7, 0.7), dl, G);
      }
      G.shared.push(dl);
      const a = this._noise(this._buf.pink);
      const e5 = this._g(0, out);
      e5.gain.setValueAtTime(0, tb);
      e5.gain.linearRampToValueAtTime(0.1 * L, tb + 0.12);
      e5.gain.setTargetAtTime(0, tb + 0.2, 0.5);
      const hp5 = this._f('highpass', 1400, 0.7, e5);
      a.connect(hp5);
      this._fire(a, tb, tb + 3.9, [hp5, e5], undefined, G);
      this._seal(G);
    });
  }

  drips() {
    if (this._baked1('drips')) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.02;
      const L = LV.drips;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.05, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const g = this._noise(this._buf.grit);
      const e1 = this._g(0, out);
      e1.gain.setValueAtTime(0, t);
      e1.gain.linearRampToValueAtTime(0.45 * L, t + 0.06);
      e1.gain.setValueAtTime(0.45 * L, t + 0.5);
      e1.gain.setTargetAtTime(0, t + 0.5, 0.9);
      const bp1 = this._f('bandpass', 1500, 0.6, e1);
      g.connect(bp1);
      this._fire(g, t, t + 6.9, [bp1, e1], undefined, G);
      const p = this._noise(this._buf.pink);
      const e2 = this._g(0, out);
      e2.gain.setValueAtTime(0, t);
      e2.gain.linearRampToValueAtTime(0.1 * L, t + 0.08);
      e2.gain.setTargetAtTime(0, t + 0.3, 0.7);
      const bp2 = this._f('bandpass', 1500, 1.1, e2);
      p.connect(bp2);
      this._fire(p, t, t + 5.4, [bp2, e2], undefined, G);
      for (let k = 0; k < 24; k++) {
        const dt = 0.05 + 5 * Math.pow(Math.random(), 1.9);
        const big = Math.random() < 0.18;
        this._drop(t + dt, big ? rand(0.5, 0.65) : rand(0.7, 1.05), (big ? 0.45 : 0.28) * (1 - 0.12 * dt) * L, rand(-0.6, 0.6), out, G);
      }
      this._seal(G);
    });
  }

  dolphins(side = 1) {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (now - (this._podLast ?? -1e9) < 120) return;
      this._podLast = now;
      this._pod = { t0: now + 0.3, dur: 9, side: side < 0 ? -1 : 1, next: now + rand(1.2, 2.4), nextClick: now + rand(3, 5) };
    });
  }

  breathe() {
    const res = this._run(() => {
      const now = this._ctx.currentTime;
      if (now < this._breathBusy) return { exhaleAt: Math.max(0, this._exhaleT - now) };
      const bk = this._take('breath');
      if (bk) {
        this._exhaleT = now + bk.exhaleAt;
        this._breathBusy = now + bk.busy;
        if (this._modeOn === 'underwater') this._play(bk, rand(0.67, 1), rand(0.97, 1.03));
        return { exhaleAt: bk.exhaleAt };
      }
      const t = now + 0.03;
      const inDur = rand(0.95, 1.15);
      const tEx = t + inDur + rand(0.12, 0.2);
      const exDur = rand(1.3, 1.7);
      this._exhaleT = tEx;
      this._breathBusy = tEx + exDur;
      if (this._modeOn !== 'underwater') return { exhaleAt: tEx - now };
      const L = LV.breath;
      const out = this._pan(0.3, this._breathBus);
      const dome = this._f('peaking', 800, 3.5);
      dome.gain.value = 6;
      const dome2 = this._f('peaking', 2400, 4, out);
      dome2.gain.value = 5;
      dome.connect(dome2);
      const G = this._grp(out, dome, dome2);
      const p = this._noise(this._buf.pink);
      const bi = this._f('bandpass', 1500, 0.7);
      bi.frequency.setValueAtTime(1200, t);
      bi.frequency.linearRampToValueAtTime(2000, t + inDur * 0.7);
      const ei = this._g(0, dome);
      ei.gain.setValueAtTime(0, t);
      ei.gain.linearRampToValueAtTime(0.4 * L, t + 0.3);
      ei.gain.linearRampToValueAtTime(0.5 * L, t + inDur * 0.65);
      ei.gain.linearRampToValueAtTime(0, t + inDur);
      p.connect(bi);
      bi.connect(ei);
      this._fire(p, t, t + inDur + 0.05, [bi, ei], undefined, G);
      const q = this._noise(this._buf.pink);
      const bo = this._f('bandpass', 850, 0.8);
      const eo = this._g(0, dome);
      eo.gain.setValueAtTime(0, tEx);
      eo.gain.linearRampToValueAtTime(0.3 * L, tEx + 0.1);
      eo.gain.linearRampToValueAtTime(0.18 * L, tEx + exDur * 0.55);
      eo.gain.linearRampToValueAtTime(0, tEx + exDur * 0.85);
      q.connect(bo);
      bo.connect(eo);
      this._fire(q, tEx, tEx + exDur, [bo, eo], undefined, G);
      const tv = tEx + rand(0.15, 0.3);
      const r = this._noise(this._buf.pink);
      const rh = this._f('highpass', 260, 0.7);
      const rl = this._f('bandpass', rand(340, 420), 1.2);
      const am = this._g(0.5);
      const er = this._g(0, out);
      er.gain.setValueAtTime(0, tv);
      er.gain.linearRampToValueAtTime(1.6 * L, tv + 0.05);
      er.gain.linearRampToValueAtTime(1.2 * L, tv + exDur * 0.55);
      er.gain.linearRampToValueAtTime(0, tv + exDur * 0.9);
      r.connect(rh);
      rh.connect(rl);
      rl.connect(am);
      am.connect(er);
      const lfo = this._osc('sine', rand(12, 17));
      const ld = this._g(0.5, am.gain);
      lfo.connect(ld);
      this._fire(r, tv, tv + exDur, [rh, rl, am, er], undefined, G);
      this._fire(lfo, tv, tv + exDur, [ld], undefined, G);
      this._bubbles(tv, 0.85 * L, rand(0.95, 1.1), { atk: 0.04, hold: exDur * 0.5, tau: 0.2, lp: 1900, hp: 280 }, out, G);
      this._bubbles(tv + exDur * 0.5, 0.22 * L, rand(1.05, 1.35), { atk: 0.3, hold: 0.25, tau: 0.3, hp: 450 }, out, G);
      this._seal(G);
      return { exhaleAt: tEx - now };
    });
    return res || { exhaleAt: 1.25 };
  }

  _helmetBuild() {
    const Hm = { srcs: [], nodes: [], next: 0, reT: 0 };
    Hm.out = this._g(0, this._breathBus);
    const w = this._live(this._noise(this._buf.white, 0.97));
    const hp = this._f('highpass', 800, 0.7);
    const bp = this._f('bandpass', 2400, 0.6);
    const edge = this._f('peaking', 2900, 4);
    edge.gain.value = 5;
    const lp = this._f('lowpass', 5500, 0.6);
    const flow = this._g(0.3, Hm.out);
    w.connect(hp);
    hp.connect(bp);
    bp.connect(edge);
    edge.connect(lp);
    lp.connect(flow);
    const b = this._live(this._noise(this._buf.brown, 0.8));
    const bhp = this._f('highpass', 120, 0.7);
    const blp = this._f('lowpass', 300, 0.7);
    const bg = this._g(0.06, Hm.out);
    b.connect(bhp);
    bhp.connect(blp);
    blp.connect(bg);
    Hm.f0 = rand(1.5, 1.9);
    const pump = this._osc('sine', Hm.f0);
    pump.setPeriodicWave(this._swellWave);
    this._live(pump);
    Hm.pump = pump;
    const m1 = this._mod(pump, 0.012, flow.gain);
    const m2 = this._mod(pump, 0.005, bg.gain);
    Hm.srcs = [w, b, pump];
    Hm.nodes = [hp, bp, edge, lp, flow, bhp, blp, bg, m1, m2];
    this._helmetL = Hm;
    return Hm;
  }

  _helmetOn(t) {
    if (this._baking) return;
    const Hm = this._helmetL || this._helmetBuild();
    setp(Hm.out.gain, LV.helmetAir, t, 0.6);
  }

  _helmetOff(t) {
    const Hm = this._helmetL;
    if (!Hm) return;
    this._helmetL = null;
    setp(Hm.out.gain, 0, t, 0.06);
    this._retire(Hm, t + 0.6);
  }

  outOfAir() {
    this._run(() => {
      if (!this._room(4, true)) return;
      const t = this._ctx.currentTime + 0.05;
      const L = LV.breath * 1.0;
      const out = this._g(1, this._breathBus);
      const G = this._grp(out);
      const breath = (t0, d, lvl, f) => {
        const n = this._noise(this._buf.pink);
        const e = this._g(0, out);
        e.gain.setValueAtTime(0, t0);
        e.gain.linearRampToValueAtTime(lvl, t0 + d * 0.35);
        e.gain.linearRampToValueAtTime(lvl * 0.7, t0 + d * 0.7);
        e.gain.linearRampToValueAtTime(0, t0 + d);
        const bp = this._f('bandpass', f, 0.9, e);
        bp.frequency.setValueAtTime(f * 0.85, t0);
        bp.frequency.linearRampToValueAtTime(f * 1.1, t0 + d);
        const hp = this._f('highpass', 400, 0.7, bp);
        n.connect(hp);
        this._fire(n, t0, t0 + d + 0.05, [hp, bp, e], undefined, G);
      };
      breath(t, rand(0.32, 0.42), 0.5 * L, rand(1300, 1700));
      breath(t + rand(0.55, 0.75), rand(0.2, 0.28), 0.28 * L, rand(1200, 1500));
      this._seal(G);
    });
  }

  airWarn(level, air) {
    this._run(() => { this._heartOff(); });
  }


  listen(dHelmet, depth, close, dWreck) {
    this._run(() => {
      const L = this._lis;
      const now = this._ctx.currentTime;
      const dH = Math.max(0, num(dHelmet, 99));
      const dp = Math.max(0, num(depth, 0));
      const cl = close ? 1 : 0;
      L.dH = dH;
      L.dW = Math.max(0, num(dWreck, 50));
      if (L.tPrev >= 0 && now > L.tPrev + 1e-4) {
        const v = (L.dPrev - dp) / (now - L.tPrev);
        L.vUp += (v - L.vUp) * Math.min(1, (now - L.tPrev) / 0.12);
      }
      L.tPrev = now;
      L.dPrev = dp;
      L.depth = dp;
      const R = this._rise;
      if (R && !R.breached && R.depth0 > 0.5) R.u = Math.max(R.u, clamp$1(1 - dp / R.depth0, 0, 1));
      if (cl !== L.close) { L.close = cl; this._nearTo(now, cl ? 0.4 : 0.6); }
      this._preRollCheck(now, dp);
      if (now - L.setAt < 0.03) return;
      L.setAt = now;
      let pH = clamp$1((9 - dH) / 6, 0, 1);
      if (cl) pH = Math.max(pH, 0.8);
      if (Math.abs(pH - L.pH) > 0.01) { L.pH = pH; setp(this._helmetPH.gain, pH, now, 0.4); setp(this._heartG.gain, pH, now, 0.4); }
      const dly = clamp$1((2 * dp) / 1500, 0.003, 0.04);
      if (Math.abs(dly - L.dly) > 0.0002) { L.dly = dly; setp(this._roomDl.delayTime, dly, now, 0.2); }
      if (R && !R.breached && Math.abs(R.u - L.u) > 0.004) { L.u = R.u; this._riseTo(R, now); }
      const A = this._airBed;
      if (A && this._modeOn === 'title') {
        const k = 1 + 0.6 * clamp$1((4 - dH) / 3, 0, 1);
        if (Math.abs(k - L.air) > 0.01) { L.air = k; setp(A.events.gain, k, now, 0.4); }
      }
    });
  }

  _preRollCheck(now, dp) {
    const R = this._rise;
    if (this._modeOn !== 'underwater' || !R || R.breached || this._preRoll) return;
    const v = this._lis.vUp;
    if (v < 0.2 || dp > 4) return;
    const tc = dp / Math.max(0.2, v);
    if (tc > 1.0) return;
    const t = now + 0.005;
    const T = Math.max(0.05, tc);
    const P0 = 0.5 * LV.breach;
    const p = this._noise(this._buf.pink);
    const lp = this._f('lowpass', 400, 1.1);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(7000, t + T);
    const hp = this._f('highpass', 180, 0.7);
    const g = this._g(0, this._sfxOut || this._plungeBus);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * P0, t + 0.4 * T);
    g.gain.exponentialRampToValueAtTime(P0, t + T);
    g.gain.setTargetAtTime(0.45 * P0, t + T, 0.12);
    g.gain.setValueAtTime(0.45 * P0, t + T + 1.6);
    g.gain.setTargetAtTime(0, t + T + 1.6, 0.15);
    p.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    this._fire(p, t, t + T + 2.6, [hp, lp, g]);
    this._preRoll = { g, at: t + T };
  }

  _duck(amb, score, helmet, down, holdFor, up) {
    const t = this._ctx.currentTime;
    const go = (p, db) => {
      if (!db) return;
      p.cancelScheduledValues(t);
      p.setTargetAtTime(Math.pow(10, db / 20), t, Math.max(0.003, down / 3));
      p.setTargetAtTime(1, t + down + holdFor, up);
    };
    if (!this._eclL) go(this._ambDuck.gain, amb);
    if (!(this._cue && !this._cue.resolved)) go(this._scoreDuck.gain, score);
    go(this._helmetDuck.gain, helmet);
  }


  gather(dur) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.02;
      const D = clamp$1(num(dur, 0.8), 0.4, 1.6);
      const L = LV.gather;
      const out = this._g(1, this._sfxBus);
      const hp = this._f('highpass', 130, 0.7, out);
      const G = this._grp(out, hp);
      const p = this._noise(this._buf.pink);
      const bp = this._f('bandpass', 700, 1);
      const lp = this._f('lowpass', 1400, 0.7);
      const e = this._g(0, out);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.12 * L, t + 0.45 * D);
      e.gain.linearRampToValueAtTime(0, t + 0.95 * D);
      p.connect(bp);
      bp.connect(lp);
      lp.connect(e);
      this._fire(p, t, t + D + 0.05, [bp, lp, e], undefined, G);
      for (const dt of [0.05, 0.36]) this._scuff(t + dt * D + rand(0, 0.03), 0.3 * L * rand(0.8, 1.1), hp, G);
      this._woodGrind(t + 0.3 * D, Math.max(0.5, 0.75 * D), 0.4 * L, hp, G);
      this._dressCreak(t + 0.6 * D, 0.6 * L, out, G);
      this._seal(G);
      this._gatherAt = t;
    });
  }

  leaveRail() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const L = LV.rail;
      const out = this._g(1, this._sfxBus);
      const G = this._grp(out);
      if (this._gatherAt && t - this._gatherAt < 3) {
        this._gatherAt = 0;
        this._clickAt(t, 0.05 * LV.gather, 700, out, 0.6, G);
        this._dressCreak(t + 0.04, 0.45 * LV.gather, out, G);
      }
      const d = rand(0.6, 0.9);
      const w = this._noise(this._buf.white);
      const am = this._g(0.5);
      const e = this._g(0, out);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.1 * L, t + d * 0.35);
      e.gain.linearRampToValueAtTime(0, t + d);
      const b1 = this._f('bandpass', 1400, 2, am);
      const g2 = this._g(0.6, am);
      const b2 = this._f('bandpass', 3200, 3, g2);
      w.connect(b1);
      w.connect(b2);
      am.connect(e);
      const j = this._osc('sawtooth', rand(25, 45));
      const jd = this._g(0.5, am.gain);
      j.connect(jd);
      this._fire(w, t, t + d + 0.05, [b1, b2, g2, am, e], undefined, G);
      this._fire(j, t, t + d + 0.05, [jd], undefined, G);
      this._seal(G);
      const A = this._airBed;
      if (A) { this._lap(t + 0.35, A, 1.6); this._creak(t + 0.45, A); }
    });
  }

  slap(u, side) {
    this._run(() => {
      const now = this._ctx.currentTime;
      let sd = side === 1 || side === 'left' ? 1 : side === 0 || side === 'right' ? 0 : -1;
      const S = this._lastSlapS || (this._lastSlapS = [-1, -1]);
      if (sd < 0) sd = now - S[0] < 0.25 ? 1 : 0;
      if (now - S[sd] < 0.25) return;
      S[sd] = now;
      const other = S[1 - sd];
      const prevAt = this._lastSlapAt || -1;
      this._lastSlap = now;
      const k = clamp$1(num(u, 0.5), 0, 1);
      const t = other >= 0 && now - other < 0.03 ? Math.max(now + 0.005, prevAt + rand(0.011, 0.015)) : now + 0.005;
      this._lastSlapAt = t;
      const L = 2.15 * LV.slap * (0.3 + 0.7 * k);
      const pan = this._pan(sd === 0 ? rand(0.1, 0.3) : rand(-0.3, -0.1), this._sfxBus);
      const G = this._grp(pan);
      const w = this._noise(this._buf.white);
      const hp = this._f('highpass', 150, 0.7);
      const pk = this._f('peaking', 700, 0.7);
      pk.gain.value = 5;
      const lp = this._f('lowpass', 2600, 0.5);
      const e = this._env(t, 0.45 * L, 0.001, rand(0.008, 0.014), pan);
      w.connect(hp);
      hp.connect(pk);
      pk.connect(lp);
      lp.connect(e);
      this._fire(w, t, t + 0.12, [hp, pk, lp, e], undefined, G);
      this._nb(t + 0.003, 1100, 0.8, 0.14 * L, 0.004, rand(0.07, 0.12), pan, G);
      const f0 = rand(280, 360);
      const pb = this._nb(t + 0.012, f0, 0.9, 1.0 * L, 0.003, 0.03, pan, G, { buf: this._buf.brown });
      if (pb) { pb.frequency.setValueAtTime(f0, t + 0.012); pb.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.06); }
      this._whump(t + 0.002, 380, 160, 0.05, 1.0 * L, 0.002, 0.03, pan, G);
      this._nb(t + 0.004, rand(500, 700), 0.8, 0.35 * L, 0.002, 0.025, pan, G, { buf: this._buf.pink });
      const n = Math.min(14, Math.round(3 + 13 * k * k));
      const dl = this._f('lowpass', 1300, 0.5, pan);
      for (let i = 0; i < n; i++) this._drop(t + 0.08 + 0.6 * Math.pow(Math.random(), 1.5), rand(0.55, 0.8), rand(0.05, 0.12) * L, rand(-0.6, 0.6), dl, G);
      G.shared.push(dl);
      this._seal(G);
    });
  }

  fishSplash(k, pan, dist, seed = 1, run = 0) {
    this._run(() => {
      if (this._modeOn === 'underwater') return;
      const A = this._airBed, dest = A && A.events ? A.events : this._sfxBus;
      if (!dest || !this._room(3, true)) return;
      let s = ((num(seed, 1) * 2654435761) ^ 0x9e3779b9) | 0;
      const r = () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const rr = (a, b) => a + (b - a) * r();
      const d = clamp$1(num(dist, 20), 4, 120);
      const t = this._ctx.currentTime + 0.01 + d / 343;
      const L = LV.fishLeap * clamp$1(num(k, 0.3), 0.05, 1) * Math.min(1, 9 / d) * (1 - 0.45 * this._night);
      const p = this._pan(clamp$1(num(pan, 0), -1, 1) * 0.75, dest);
      const lp = this._f('lowpass', 900 + 7000 * Math.min(1, 10 / d), 0.5, p);
      const G = this._grp(p, lp);
      const burst = (t0, f, q, lvl, atk, tau) => {
        if (!this._room(1, true)) return;
        const src = this._src(this._buf.pink, true);
        src._off = r() * this._buf.pink.duration * 0.9;
        const flt = this._f('bandpass', f, q);
        const e = this._g(0, lp);
        e.gain.setValueAtTime(0, t0);
        e.gain.linearRampToValueAtTime(lvl * Math.min(8, Math.sqrt((q * 2000) / f)), t0 + atk);
        e.gain.setTargetAtTime(0, t0 + atk, tau);
        src.connect(flt);
        flt.connect(e);
        this._fire(src, t0, t0 + atk + tau * 6 + 0.01, [flt, e], undefined, G);
      };
      const rn = num(run, 0);
      if (rn > 0) {
        const n = Math.max(3, Math.round(rn / 0.06));
        for (let i = 0; i < n; i++) burst(t + (rn * i) / n + rr(0, 0.015), rr(1400, 2600), 1.1, L * rr(0.35, 0.6) * (1 - 0.4 * (i / n)), 0.002, rr(0.012, 0.022));
      } else {
        burst(t, rr(600, 1000), 0.8, L * 0.9, 0.003, rr(0.025, 0.045));
        burst(t + 0.02, rr(1600, 2400), 0.6, L * 0.35, 0.04, rr(0.12, 0.2));
        const nd = 2 + Math.round(3 * clamp$1(num(k, 0.3), 0, 1));
        for (let i = 0; i < nd; i++) burst(t + rr(0.12, 0.5), rr(2200, 3800), 1.4, L * rr(0.08, 0.16), 0.002, rr(0.008, 0.015));
      }
      this._seal(G);
    });
  }

  plop(s) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const k = clamp$1(num(s, 0.7), 0.2, 1.2);
      const L = 1.5 * LV.plop * k;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.08, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      this._whump(t, 320, 110, 0.06, 1.6 * L, 0.004, 0.08, out, G);
      const fb = rand(260, 380);
      const bb = this._nb(t + 0.05, fb, 0.9, 0.35 * L, 0.004, 0.045, out, G, { buf: this._buf.brown });
      if (bb) { bb.frequency.setValueAtTime(fb, t + 0.05); bb.frequency.exponentialRampToValueAtTime(fb * 1.35, t + 0.14); }
      this._nb(t, 650, 0.5, 0.14 * L, 0.02, 0.3, out, G, { buf: this._buf.pink, type: 'lowpass' });
      const n = Math.round(8 + 10 * k);
      const dl = this._f('lowpass', 1300, 0.5, out);
      for (let i = 0; i < n; i++) this._drop(t + 0.5 * Math.random(), rand(0.5, 0.75), rand(0.12, 0.28) * L, rand(-0.7, 0.7), dl, G);
      G.shared.push(dl);
      this._seal(G);
    });
  }

  helmetUnder(w) {
    this._run(() => {
      const now = this._ctx.currentTime;
      const k = clamp$1(num(w, 3) / 3, 0.3, 1.2);
      const S = this._plungeS > 0 && now - this._plungeAt < 2 ? this._plungeS : k;
      const kk = Math.pow(clamp$1(S, 0.3, 1.6), 0.55) * (0.85 + 0.15 * k);
      const L = LV.under * kk;
      const out = this._g(1, this._plungeBus);
      const G = this._grp(out);
      const t = now + rand(0.15, 0.25);
      this._thud(t, 84 * rand(0.9, 1.1), 0.36 * L, 0.005, 0.1, out, G, 1.25, 0.04, this._beaconWave);
      this._thud(t, rand(190, 250), 0.3 * L, 0.004, 0.06, out, G, 1.2, 0.03);
      const r0 = now + 0.02;
      this._bubbles(r0, 0.75 * L, rand(1.4, 1.8), { atk: 0.3, hold: 0.2, tau: 0.8, hp: 350 }, out, G);
      this._bubbles(r0 + 0.1, 0.4 * L, rand(0.8, 1.0), { atk: 0.25, hold: 0.2, tau: 0.6, lp: 1600, hp: 200 }, out, G);
      this._nb(r0, 1000, 0.5, 0.22 * L, 0.5, 0.8, out, G, { buf: this._buf.pink });
      this._nb(r0, 260, 0.9, 0.16 * L, 0.3, 0.7, out, G, { buf: this._buf.brown });
      this._seal(G);
      this._helmetOn(now);
      this._schoolUntil = now + 10;
      this._descent = true;
      this._nextDiveBreath = now + 4.5;
    });
  }

  _lensSwirl(t) {
    const dest = this._sfxOut || this._sfxBus;
    const G = this._grp();
    const S = clamp$1(this._plungeS || 1, 0.5, 1.4);
    const L = 1.2 * LV.under * Math.pow(S, 0.55);
    this._bubbles(t, L, 1.2, { atk: 0.015, hold: 0.12, tau: 0.22, hp: 450, lp: 6000 }, dest, G);
    this._bubbles(t + 0.03, 0.6 * L, 0.85, { atk: 0.03, hold: 0.1, tau: 0.2, hp: 250, lp: 2500 }, dest, G);
    const gb = this._nb(t, 1400, 0.7, 0.12 * L, 0.012, 0.16, dest, G, { buf: this._buf.pink, hold: 0.04 });
    if (gb) { gb.frequency.setValueAtTime(2200, t); gb.frequency.exponentialRampToValueAtTime(700, t + 0.35); }
    for (let i = 0; i < 6; i++) this._drop(t + 0.02 + 0.35 * Math.random(), rand(0.9, 1.3), rand(0.08, 0.16) * L, rand(-0.6, 0.6), dest, G);
    this._seal(G);
  }

  diveBreath(dur) {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (!this._descent || this._modeOn !== 'underwater') return;
      const d = clamp$1(num(dur, 1.7), 0.6, 3);
      this._diveBrAt = now + Math.max(0, (d * 0.42) / 0.34 - 1.3);
      this._nextDiveBreath = now + 9;
    });
  }

  release() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.02;
      const L = LV.release;
      const out = this._pan(0.3, this._breathBus);
      const G = this._grp(out);
      const q = this._noise(this._buf.pink);
      const bo = this._f('bandpass', 850, 0.9);
      const eo = this._g(0, out);
      eo.gain.setValueAtTime(0, t);
      eo.gain.linearRampToValueAtTime(0.5 * L, t + 0.08);
      eo.gain.linearRampToValueAtTime(0.25 * L, t + 0.7);
      eo.gain.linearRampToValueAtTime(0, t + 1.2);
      q.connect(bo);
      bo.connect(eo);
      this._fire(q, t, t + 1.25, [bo, eo], undefined, G);
      this._bubbles(t + 0.08, 1.1 * L, 0.55, { atk: 0.05, hold: 0.45, tau: 0.25, lp: 1300 }, out, G);
      for (const dt of [0.15, 0.42]) this._gulp(t + dt + rand(0, 0.05), rand(125, 155), 0.45 * L, out, G);
      this._seal(G);
    });
  }

  valve(open) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.02;
      const on = !!open;
      const L = LV.valve;
      const out = this._pan(0.3, this._breathBus);
      const G = this._grp(out);
      const n = on ? 4 + ((Math.random() * 3) | 0) : 3;
      for (let i = 0; i < n; i++) this._nb(t + i * 0.03 * rand(0.8, 1.2), 2200 * rand(0.95, 1.05), 5, 0.05 * L, 0.001, 0.004, out, G);
      if (on) this._bubbles(t + 0.1, 0.3 * L, 0.8, { atk: 0.03, hold: 0.2, tau: 0.2, lp: 2000 }, out, G);
      this._seal(G);
      this._plume = on;
    });
  }

  land(v) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const k = clamp$1(num(v, 0.6) / 1.2, 0.2, 1);
      const L = LV.land * (0.4 + 0.6 * k);
      const vp = this._pan(0.3, this._breathBus);
      const G = this._grp(vp);
      for (let b = 0; b < 2; b++) {
        const tb = t + b * rand(0.04, 0.07);
        const pan = this._pan(b ? 0.12 : -0.12, this._sfxBus);
        G.shared.push(pan);
        this._thud(tb, rand(70, 100), 0.8 * L, 0.006, 0.08, pan, G);
        this._nb(tb, 1300, 1, 0.3 * L, 0.002, 0.014, pan, G, { buf: this._buf.grit });
        this._nb(tb, 350, 3, 0.25 * L, 0.001, 0.025, this._suitBus, G);
      }
      for (const dt of [0.06, 0.11]) this._nb(t + dt, 200, 2, 0.2 * L, 0.001, 0.018, this._suitBus, G);
      this._nb(t + 0.02, 400, 0.7, 0.2 * L, 0.4, 0.5, this._sfxBus, G, { buf: this._buf.pink, type: 'lowpass' });
      this._nb(t + 0.05, 250, 0.7, 0.25 * L, 0.1, 0.2, this._breathBus, G, { buf: this._buf.brown, type: 'lowpass' });
      this._bubbles(t + 0.15, 0.9 * L, 0.7, { atk: 0.05, hold: 0.35, tau: 0.25, lp: 1600 }, vp, G);
      this._seal(G);
      this._plume = false;
      this._schoolUntil = 0;
      this._descent = false;
    });
  }


  footfall(side, k, kind) {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (now - this._lastFoot < 0.18 || this._modeOn !== 'underwater' || !this._room(8, true)) return;
      this._lastFoot = now;
      const K = clamp$1(num(k, 0.6), 0, 1);
      const far = Math.min(1, 2.5 / Math.max(0.5, this._lis.dH));
      const L = LV.foot * (0.35 + 0.65 * K) * far;
      if (L < 0.01) return;
      const t = now + 0.005;
      const right = side === 'right' || side === 1;
      const pan = this._pan(right ? 0.1 : -0.1, this._sfxBus);
      const G = this._grp(pan);
      const kd = num(kind, 0) | 0;
      const FH = this._footF;
      let f0 = (right ? 90 : 82) * rand(0.86, 1.14);
      for (let k = 0; k < 6 && FH.some((x) => Math.abs(f0 / x - 1) < 0.05); k++) f0 = (right ? 90 : 82) * rand(0.86, 1.14);
      FH.push(f0);
      if (FH.length > 3) FH.shift();
      const v = rand(0.8, 1.2);
      const thud = kd === 0 ? 0.21 : 0.19;
      this._thud(t + rand(0.004, 0.01), f0, thud * L * v, rand(0.008, 0.015), rand(0.045, 0.08), pan, G, rand(1.2, 1.6), rand(0.015, 0.04));
      this._nb(t + rand(0, 0.006), rand(150, 210), 0.8, 0.3 * L * v, rand(0.006, 0.012), rand(0.04, 0.07), pan, G, { buf: this._buf.brown, type: 'lowpass' });
      if (kd === 1) {
        this._nb(t, rand(220, 270), 4, 0.5 * L * v, 0.001, 0.035, pan, G);
        this._nb(t + rand(0.003, 0.008), rand(1300, 1800), 1.5, 0.5 * L * v, 0.004, rand(0.02, 0.04), pan, G);
        this._nb(t + rand(0.003, 0.008), rand(1300, 1800), 2, 0.28 * L * v, 0.004, rand(0.02, 0.04), pan, G, { buf: this._buf.grit });
        this._nb(t + 0.002, rand(2300, 2900), 3, 0.12 * L, 0.0005, 0.004, pan, G);
      } else if (kd === 3) {
        this._nb(t, rand(140, 165), 5, 0.6 * L * v, 0.002, 0.07, pan, G);
        this._nb(t, rand(390, 450), 4, 0.35 * L * v, 0.002, 0.05, pan, G);
        if (Math.random() < 0.2) this._woodGrind(t + rand(0.05, 0.15), rand(0.4, 0.7), 0.3 * L, pan, G);
      } else {
        this._nb(t, rand(200, 240), 1.2, 0.2 * L * v, 0.004, rand(0.035, 0.05), pan, G);
        const tc = t + rand(0.004, 0.014);
        this._nb(tc, rand(900, 1500), 0.9, 1.0 * L * v, 0.003, rand(0.012, 0.025), pan, G);
        this._nb(tc, rand(800, 1400), 1, 0.8 * L * v, 0.003, rand(0.015, 0.035), pan, G, { buf: this._buf.grit2 });
        this._nb(t + rand(0.02, 0.045), rand(1200, 2000), 1.2, 0.6 * L * rand(0.7, 1.2), 0.003, rand(0.012, 0.028), pan, G, { buf: this._buf.grit2 });
        this._nb(t + 0.02, 400, 0.7, 0.03 * L, rand(0.3, 0.6), 0.25, pan, G, { buf: this._buf.pink, type: 'lowpass' });
      }
      this._nb(t, 350, 3, 0.08 * L, 0.001, 0.025, this._suitBus, G);
      if (Math.random() < 0.35) this._dressCreak(t + rand(0.04, 0.12), 0.45 * LV.foot * far, this._suitBus, G);
      this._seal(G);
    });
  }

  kneel() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const L = LV.kneel;
      const pan = this._pan(0.08, this._sfxBus);
      const vp = this._pan(0.3, this._breathBus);
      const G = this._grp(pan, vp);
      this._thud(t, rand(65, 80), 0.6 * L, 0.012, 0.1, pan, G);
      this._nb(t, 180, 1.5, 0.15 * L, 0.004, 0.05, pan, G);
      this._nb(t + 0.01, 1000, 1, 0.3 * L, 0.004, 0.027, pan, G, { buf: this._buf.grit });
      this._groan(t + 0.02, rand(20, 35), rand(30, 50), 0.2, [[500, 4, 1]], 0.8 * L, this._suitBus, G);
      this._nb(t + 0.05, 250, 0.7, 0.3 * L, 0.2, 0.2, this._breathBus, G, { buf: this._buf.brown, type: 'lowpass' });
      this._bubbles(t + 0.2, 0.5 * L, 0.9, { atk: 0.03, hold: 0.15, tau: 0.15, lp: 1800 }, vp, G);
      this._nb(t + 0.03, 400, 0.7, 0.06 * L, 0.35, 0.3, pan, G, { buf: this._buf.pink, type: 'lowpass' });
      this._seal(G);
    });
  }

  stow(n) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const N = clamp$1(Math.round(num(n, 1)), 1, 3);
      const L = LV.stow;
      const pan = this._pan(-0.15, this._sfxBus);
      const lp = this._f('lowpass', 1200, 0.7, pan);
      const G = this._grp(pan, lp);
      this._nb(t, 260, 2, 0.3 * L, 0.002, 0.05, pan, G);
      this._nb(t + 0.01, 1200, 1, 0.06 * L, 0.03, 0.08, pan, G, { buf: this._buf.pink });
      const got = this._revealedIdx || [];
      if (N >= 2) for (let j = 0; j < Math.min(2, got.length); j++) this._wheel(t + 0.03 + j * 0.012, got[got.length - 1 - j], 0.055 * L, lp, G, rand(0.95, 1.1));
      if (N >= 3) this._thud(t + 0.02, 110, 0.3 * L, 0.006, 0.07, pan, G);
      this._seal(G);
    });
  }

  _heartOn(air) {
    const now = this._ctx.currentTime;
    if (this._heart) { this._heart.air0 = air; this._heart.t0 = now; return; }
    this._heart = { air0: air, t0: now, next: now + 0.3, on: now };
  }

  _heartOff() { this._heart = null; }

  _schedHeart(now, h) {
    const H = this._heart;
    if (!H) return;
    const air = H.air0 - (now - H.t0);
    if (this._modeOn !== 'underwater' || air <= 0) { this._heart = null; return; }
    if (H.next < now - 0.3) H.next = now + 0.05;
    const per = 60 / (72 + 38 * clamp$1(1 - air / 31, 0, 1));
    const db = -8 * clamp$1((air - 5) / 25, 0, 1);
    const L = LV.heart * Math.pow(10, db / 20) * clamp$1((now - H.on) / 4, 0, 1);
    for (let i = 0; i < 2 && H.next < h; i++) {
      const t = H.next;
      this._thud(t, 38, L, 0.012, 0.05, this._heartIn, null, 1.25, 0.03, this._heartWave);
      this._nb(t, 150, 1.5, 0.25 * L, 0.004, 0.04, this._heartIn);
      const t2 = t + 0.36 * per * rand(0.97, 1.03);
      this._thud(t2, rand(55, 66), 0.7 * L, 0.01, 0.04, this._heartIn, null, 1.2, 0.025, this._heartWave);
      this._nb(t2, 190, 1.5, 0.16 * L, 0.004, 0.035, this._heartIn);
      H.next += per;
    }
  }


  _thud(t, f, lvl, atk, tau, dest, G, drop = 1.4, dropT = 0.03, wave = null) {
    if (!this._oscRoom(1) || !this._room(1)) return;
    const o = this._osc('sine', f * drop);
    o.setPeriodicWave(wave || this._thudWave);
    o.frequency.setValueAtTime(f * drop, t);
    o.frequency.exponentialRampToValueAtTime(f, t + Math.max(0.005, dropT));
    const e = this._env(t, lvl, atk, tau, dest);
    o.connect(e);
    this._fire(o, t, t + atk + tau * 6, [e], undefined, G);
  }

  _whump(t, f0, f1, dt, lvl, atk, tau, dest, G, o = {}) {
    if (!this._room(1, !o.pri)) return null;
    const s = this._noise(o.buf || this._buf.brown);
    const l1 = this._f('lowpass', f0, 0.5);
    const l2 = this._f('lowpass', f0 * 1.3, 0.5);
    for (const [l, k] of [[l1, 1], [l2, 1.3]]) {
      l.frequency.setValueAtTime(f0 * k, t);
      l.frequency.exponentialRampToValueAtTime(f1 * k, t + Math.max(0.01, dt));
    }
    const e = this._g(0, dest);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(lvl, t + atk);
    const th = t + atk + (o.hold || 0);
    if (o.hold) e.gain.setValueAtTime(lvl, th);
    e.gain.setTargetAtTime(0, th, tau);
    s.connect(l1);
    l1.connect(l2);
    l2.connect(e);
    this._fire(s, t, th + tau * 6 + 0.01, [l1, l2, e], undefined, G || undefined);
    return l1;
  }

  _nb(t, f, q, lvl, atk, tau, dest, G, o = {}) {
    if (!this._room(1, !o.pri)) return null;
    const s = this._noise(o.buf || this._buf.white, o.rate || 1);
    const type = o.type || 'bandpass';
    const flt = this._f(type, f, q);
    const k = type === 'bandpass' ? Math.min(8, Math.sqrt((q * 2000) / f)) : 1;
    const e = this._g(0, dest);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(lvl * k, t + atk);
    const th = t + atk + (o.hold || 0);
    if (o.hold) e.gain.setValueAtTime(lvl * k, th);
    e.gain.setTargetAtTime(0, th, tau);
    s.connect(flt);
    flt.connect(e);
    this._fire(s, t, th + tau * 6 + 0.01, [flt, e], undefined, G || undefined);
    return flt;
  }

  _groan(t, f0, f1, dur, bands, lvl, dest, G) {
    if (!this._oscRoom(1) || !this._room(1, true)) return;
    const o = this._osc('sawtooth', f0);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur);
    const env = this._g(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + dur * 0.3);
    env.gain.setValueAtTime(lvl, t + dur * 0.65);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const nodes = [env];
    for (const [f, q, g] of bands) {
      const gg = this._g(g, env);
      const bp = this._f('bandpass', f * rand(0.92, 1.08), q, gg);
      o.connect(bp);
      nodes.push(gg, bp);
    }
    this._fire(o, t, t + dur + 0.02, nodes, undefined, G);
  }

  _dressCreak(t, lvl, dest, G) {
    const f = rand(15, 60);
    this._groan(t, f, f * rand(0.8, 1.3), rand(0.08, 0.25), [[rand(350, 900), 4, 1], [1800, 6, 0.5]], lvl, dest, G);
  }

  _scuff(t, lvl, dest, G) {
    const d = rand(0.06, 0.12);
    const w = this._noise(this._buf.white);
    const bp = this._f('bandpass', 700, 1.5);
    const lp = this._f('lowpass', 3000, 0.7);
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(1200, t + d);
    const e = this._g(0, dest);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(lvl * 0.6, t + 0.01);
    e.gain.setTargetAtTime(0, t + d * 0.6, d * 0.3);
    w.connect(bp);
    bp.connect(lp);
    lp.connect(e);
    this._fire(w, t, t + d * 2 + 0.05, [bp, lp, e], undefined, G);
    this._nb(t, 180, 4, lvl, 0.001, 0.03, dest, G);
  }

  _gulp(t, f, lvl, dest, G) {
    if (!this._oscRoom(1) || !this._room(1, true)) return;
    const o = this._osc('sine', f);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.09);
    const e = this._env(t, lvl, 0.004, 0.045, dest);
    o.connect(e);
    this._fire(o, t, t + 0.35, [e], undefined, G);
  }

  _wheel(t, w, gain, dest, G, rate = 1, pri = false) {
    const b = this._buf['wheel' + clamp$1(Math.round(num(w, 2)), 0, 2)];
    if (!b || !this._room(1, !pri)) return;
    const s = this._src(b);
    s.playbackRate.value = rate * rand(0.99, 1.01);
    const g = this._g(WHEEL_GAIN[clamp$1(Math.round(num(w, 2)), 0, 2)] * gain * rand(0.85, 1.15), dest);
    s.connect(g);
    this._fire(s, t, t + b.duration / s.playbackRate.value + 0.02, [g], 0, G || undefined);
  }

  _tooth(t, w, lvl, dest, G, pri = false) {
    if (!this._room(1, !pri)) return;
    const s = this._src(this._buf.tooth);
    const r = TOOTH_RATE[clamp$1(w | 0, 0, 2)] * rand(0.96, 1.04);
    s.playbackRate.value = r;
    const g = this._g(TOOTH_GAIN[clamp$1(w | 0, 0, 2)] * lvl * rand(0.84, 1.19), dest);
    s.connect(g);
    this._fire(s, t, t + 0.09 / r + 0.02, [g], 0, G || undefined);
  }

  _ping(t, f, lvl, tau, dest, G) {
    if (!this._oscRoom(1) || !this._room(1, true)) return;
    const o = this._osc('sine', f);
    const e = this._env(t, lvl, 0.001, tau, dest);
    o.connect(e);
    this._fire(o, t, t + tau * 7, [e], undefined, G);
  }


  sonar() {
    this._run(() => this._duck(-6, 0, 0, 0.02, 0.1, 0.6));
    if (this._baked1('sonar')) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const f = 587.33;
      const L = LV.sonar;
      const out = this._g(1, this._sfxBus);
      const rev = this._g(0.4, this._reverb);
      out.connect(rev);
      const dl = this._ctx.createDelay(1);
      dl.delayTime.value = 0.23;
      const dlp = this._f('lowpass', 1000, 0.5);
      const fb = this._g(0.35);
      const tail = this._g(0.3, this._sfxBus);
      out.connect(dl);
      dl.connect(dlp);
      dlp.connect(fb);
      fb.connect(dl);
      dlp.connect(tail);
      const G = this._grp(out, rev, dl, dlp, fb, tail);
      const wob = this._osc('sine', 0.8);
      const wd = this._g(0.004, dl.delayTime);
      wob.connect(wd);
      this._fire(wob, t, t + 3, [wd], undefined, G);
      this._bell(t, f, 1.25 * L, { dest: out, lp: 1600, tau: 0.12, grp: G });
      this._bell(t + 0.003, f * 1.0013, 0.5 * L, { dest: out, lp: 1400, tau: 0.11, grp: G });
      const o = this._osc('sine', f);
      const e = this._env(t, 0.3 * L, 0.003, 0.05, out);
      o.connect(e);
      this._fire(o, t, t + 0.4, [e], undefined, G);
      this._nb(t, 700, 1.5, 0.2 * L, 0.001, 0.012, out, G, { pri: true });
      this._thud(t, 95, 0.4 * L, 0.004, 0.05, out, G, 1.3, 0.03, this._beaconWave);
      this._seal(G);
    });
  }

  echo(delay, i) {
    const d = clamp$1(num(delay, 1), 0, 4);
    const far = clamp$1((d - 0.2) / 2.3, 0, 1);
    const w = typeof i === 'number' && Number.isFinite(i) ? clamp$1(Math.round(i), 0, 2) : -1;
    const fr = w >= 0 ? mtof(WHEEL_BELL[w]) / ECHO_F : 1;
    const k = (1 - 0.5 * far) / (1 - 0.5 * ECHO_FAR);
    if (this._baked1('echo', k, fr * rand(0.997, 1.003), (k * (0.45 + 0.35 * far)) / (0.45 + 0.35 * ECHO_FAR))) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const f = 0.5 * ECHO_F * fr;
      const g = 0.55 * LV.echo * (1 - 0.5 * far);
      const lp = 2200 - 1100 * far;
      const pan = rand(-0.5, 0.5);
      this._bell(t, f, g, { dest: this._sfxBus, pan, lp, send: 0.45 + 0.35 * far, tau: 0.22 + 0.12 * far });
      this._bell(t + 0.012, f * 1.498, g * 0.2, { dest: this._sfxBus, pan: -pan * 0.5, lp, send: 0.6, tau: 0.14, low: true });
    });
  }

  sonarNotReady() {}

  scan(duration) {
    if (Math.abs(num(duration, SCAN_BAKE) - SCAN_BAKE) < 0.01 && this._baked1('scan')) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const d = clamp$1(num(duration, 1.1), 0.2, 12);
      const L = LV.scan;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.2, this._reverb);
      out.connect(send);
      const shape = (g, lvl) => {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(lvl * L, t + Math.min(0.12, d * 0.25));
        g.gain.setValueAtTime(lvl * L, t + d - Math.min(0.18, d * 0.3));
        g.gain.linearRampToValueAtTime(0, t + d);
      };
      const end = t + d + 0.05;
      const hg = this._g(0, out);
      shape(hg, 0.16);
      const trem = this._g(0.7, hg);
      const hbp = this._f('bandpass', 360, 0.8, trem);
      const G = this._grp(out, send, hg, trem, hbp);
      const h1 = this._osc('sawtooth', 73.42);
      h1.connect(hbp);
      const tl = this._osc('sine', 11);
      const tld = this._g(0.3, trem.gain);
      tl.connect(tld);
      this._fire(h1, t, end, null, undefined, G);
      this._fire(tl, t, end, [tld], undefined, G);
      const n = this._noise(this._buf.pink);
      const sg = this._g(0, out);
      shape(sg, 0.5);
      const sbp = this._f('bandpass', 350, 4, sg);
      sbp.frequency.setValueAtTime(350, t);
      sbp.frequency.exponentialRampToValueAtTime(2800, t + d);
      n.connect(sbp);
      this._fire(n, t, end, [sbp, sg], undefined, G);
      const gt = this._osc('triangle', 293.66);
      gt.frequency.setValueAtTime(293.66, t);
      gt.frequency.exponentialRampToValueAtTime(1174.66, t + d);
      const gg = this._g(0, out);
      shape(gg, 0.035);
      const glp = this._f('lowpass', 3000, 0.7, gg);
      gt.connect(glp);
      this._fire(gt, t, end, [glp, gg], undefined, G);
      const c = this._noise(this._buf.grit);
      const cg = this._g(0, out);
      shape(cg, 0.07);
      const chp = this._f('highpass', 3500, 0.7, cg);
      c.connect(chp);
      this._fire(c, t, end, [chp, cg], undefined, G);
      this._clickAt(t + d, 0.25 * L, 1300, out, 0.6, G);
      this._nb(t + d, 300, 2, 0.18 * L, 0.001, 0.03, out, G, { pri: true });
      this._seal(G);
    });
  }

  reveal(index) {
    const i = clamp$1(Math.round(num(index, 0)), 0, 2);
    const n = clamp$1(this._revealed, 0, 2);
    this._revealed++;
    (this._revealedIdx || (this._revealedIdx = [])).push(i);
    if (this._revealed >= 3) this._prebuildSwell();
    this._run(() => {
      const now = this._ctx.currentTime;
      this._lyreQuiet = now + 25;
      this._heartOff();
      this._duck(-6, -4, -3, 0.08, 1.2 + 0.5 * n, 1.2);
      const G = this._grp();
      this._wheel(now + 0.02, i, 0.6 * LV.ring, this._sfxBus, G, 1, true);
      this._nb(now + 0.03, 900, 0.7, 0.12 * LV.ring, 0.05, 0.25, this._sfxBus, G, { buf: this._buf.pink, type: 'lowpass' });
      this._seal(G);
    });
    if (!this._baked1(REVEAL_BAKES[n])) this._revealMusic(n);
  }

  _revealMusic(n) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.02;
      const R = REVEALS[clamp$1(n, 0, 2)];
      const L = LV.reveal * (n >= 2 ? 0.67 : 1);
      const out = this._g(1, this._stingBus);
      const send = this._g(0.35 + 0.1 * n, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      for (const [m, dt, g, pan] of R.bells) this._bell(t + dt, mtof(m), g * L, { dest: out, pan, lp: 2600, tau: 0.9, grp: G });
      for (const [m, dt, v] of R.lyre) this._lyre(t + dt, m, v * L, clamp$1((m - 78) / 12, -0.4, 0.4), { dest: out, decay: 1.8, grp: G });
      if (R.choir) this._choir(t + 0.05, R.choir, (0.05 + 0.015 * n) * L, 3.2 + 0.6 * n, R.vowel, out, G);
      const k = R.sparkle.length;
      R.sparkle.forEach((m, j) => this._bell(t + 0.5 + j * 0.09, mtof(m), 0.06 * L,
        { dest: out, pan: -0.6 + (1.2 * j) / Math.max(1, k - 1), lp: 2600, tau: 0.3, low: true, grp: G }));
      this._swellTone(t, mtof(R.low), (0.1 + 0.03 * n) * L, 3 + n, out, G);
      if (R.boom) this._boom(t, 0.22 * L, out, G);
      this._air(t + 0.1, 1.4 + 0.4 * n, (0.012 + 0.004 * n) * L, out, G);
      this._seal(G);
    });
  }

  pickup(i) {
    if (typeof i === 'number' && Number.isFinite(i)) {
      this._run(() => this._wheel(this._ctx.currentTime + 0.03, clamp$1(Math.round(i), 0, 2), 0.3 * LV.ring, this._sfxBus, null, 1, true));
    }
    if (this._baked1('pickup')) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const L = LV.pickup;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.25, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const b = this._noise(this._buf.brown);
      const e1 = this._env(t, 0.9 * L, 0.006, 0.06, out);
      const lp1 = this._f('lowpass', 380, 1.8, e1);
      b.connect(lp1);
      this._fire(b, t, t + 0.6, [lp1, e1], undefined, G);
      const o = this._osc('sine', 120);
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
      const e2 = this._env(t, 0.75 * L, 0.003, 0.08, out);
      o.connect(e2);
      this._fire(o, t, t + 0.7, [e2], undefined, G);
      const p = this._noise(this._buf.pink);
      const e3 = this._g(0, out);
      e3.gain.setValueAtTime(0, t + 0.01);
      e3.gain.linearRampToValueAtTime(0.5 * L, t + 0.05);
      e3.gain.setValueAtTime(0.5 * L, t + 0.25);
      e3.gain.setTargetAtTime(0, t + 0.25, 0.12);
      const bp3 = this._f('bandpass', 480, 1.2, e3);
      const e4 = this._g(0, out);
      e4.gain.setValueAtTime(0, t + 0.08);
      e4.gain.linearRampToValueAtTime(0.22 * L, t + 0.18);
      e4.gain.setTargetAtTime(0, t + 0.3, 0.4);
      const bp4 = this._f('bandpass', 2600, 0.8, e4);
      p.connect(bp3);
      p.connect(bp4);
      this._fire(p, t, t + 3.2, [bp3, e3, bp4, e4], undefined, G);
      const g = this._noise(this._buf.grit);
      const e5 = this._g(0, out);
      e5.gain.setValueAtTime(0, t + 0.05);
      e5.gain.linearRampToValueAtTime(0.55 * L, t + 0.15);
      e5.gain.setTargetAtTime(0, t + 0.2, 0.45);
      const hp5 = this._f('highpass', 1800, 0.7, e5);
      g.connect(hp5);
      this._fire(g, t, t + 3.4, [hp5, e5], undefined, G);
      this._bell(t + 0.02, 146.83, 0.16 * L, { dest: out, lp: 1100, dur: 3, soft: true, grp: G });
      this._seal(G);
    });
  }

  tick(progress01) {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (now - this._lastTick < 0.012 || !this._room(1, true)) return;
      this._lastTick = now;
      const p = clamp$1(num(progress01, 0), 0, 1);
      const acc = Math.round(p * 36) % 6 === 0;
      const t = now + 0.003;
      const s = this._src(this._buf.tooth);
      s.playbackRate.value = (0.9 + 0.45 * p) * rand(0.985, 1.015);
      this._tickPan = -this._tickPan;
      const pan = this._pan(this._tickPan, this._sfxBus);
      const g = this._g((0.16 + 0.1 * p) * (acc ? 1.8 : 1) * LV.tick, pan);
      s.connect(g);
      this._fire(s, t, t + 0.1, [g, pan], 0);
    });
  }

  crack(intensity = 1) {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (now - this._lastCrack < 0.02 || !this._room(3, true)) return;
      this._lastCrack = now;
      const k = clamp$1(num(intensity, 1), 0.1, 1.5);
      const L = LV.crack;
      const t = now + rand(0, 0.006);
      const pan = this._pan(rand(-0.3, 0.3), this._sfxBus);
      const G = this._grp(pan);
      const s = this._noise(this._buf.grit);
      const len = 0.025 + 0.045 * k;
      const e = this._g(0, pan);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.9 * (0.85 + 0.15 * k) * L, t + 0.003);
      e.gain.setTargetAtTime(0, t + 0.003, len / 3);
      const bp = this._f('bandpass', rand(1600, 3800), 0.9, e);
      s.connect(bp);
      this._fire(s, t, t + len * 2.5, [bp, e], undefined, G);
      if (Math.random() < 0.6) this._nb(t + rand(0.04, 0.08), rand(450, 800), 0.7, 0.12 * Math.min(k, 1) * L, 0.012, rand(0.03, 0.06), pan, G, { buf: this._buf.grit, type: 'lowpass' });
      this._seal(G);
    });
  }

  sandPour(duration = 1.3) {
    const d0 = num(duration, 1.3);
    if (Math.abs(d0 - 1.4) < 0.01 ? this._baked1('pour') : Math.abs(d0 - 0.8) < 0.01 && this._baked1('pourS')) return;
    this._run(() => {
      const d = clamp$1(num(duration, 1.3), 0.2, 6);
      const t = this._ctx.currentTime + 0.01;
      const L = LV.pour;
      const out = this._g(1, this._sfxBus);
      const G = this._grp(out);
      const end = t + 0.5 * d + 2.3 * d;
      const shape = (g, lvl) => {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(lvl * L, t + 0.1);
        g.gain.setValueAtTime(lvl * L, t + 0.5 * d);
        g.gain.setTargetAtTime(0, t + 0.5 * d, 0.3 * d);
      };
      const p = this._noise(this._buf.pink);
      const e1 = this._g(0, out);
      shape(e1, 0.5);
      const bp1 = this._f('bandpass', 2200, 0.7, e1);
      bp1.frequency.setValueAtTime(2200, t);
      bp1.frequency.exponentialRampToValueAtTime(900, t + d * 1.2);
      p.connect(bp1);
      this._fire(p, t, end, [bp1, e1], undefined, G);
      const g = this._noise(this._buf.grit);
      const e2 = this._g(0, out);
      shape(e2, 0.45);
      const bp2 = this._f('bandpass', 3000, 0.8, e2);
      g.connect(bp2);
      this._fire(g, t, end, [bp2, e2], undefined, G);
      const b = this._noise(this._buf.brown);
      const e3 = this._g(0, out);
      e3.gain.setValueAtTime(0, t);
      e3.gain.linearRampToValueAtTime(0.5 * L, t + 0.2);
      e3.gain.setTargetAtTime(0, t + 0.4 * d, 0.35 * d);
      const lp3 = this._f('lowpass', 260, 0.7, e3);
      b.connect(lp3);
      this._fire(b, t, end, [lp3, e3], undefined, G);
      this._seal(G);
    });
  }

  brush(intensity, v, p, i) {
    this._run(() => {
      const a = clamp$1(num(intensity, 0), 0, 1);
      const w = typeof i === 'number' && i >= 0 ? clamp$1(Math.round(i), 0, 2) : -1;
      const now = this._ctx.currentTime;
      if (this._brushL && w >= 0 && this._brushL.w !== w) { this._retire(this._brushL, now + 0.2); this._brushL = null; }
      if (!this._brushL) {
        if (a < 0.003) return;
        this._brushBuild(w);
      }
      this._brushTo(a, now, v, p);
    });
  }

  _brushBuild(w) {
    const B = { a: -1, sp: -1, env: 0, idleAt: 0, w, c: 1, p: -1, rate: 0, vx: 0, vy: 0, vz: 0, tPrev: -1, setAt: -1,
      lastRev: -1, lfoOn: false, stillT: 1, miles: 0, fc: 1, q: 0, srcs: [], nodes: [] };
    B.out = this._g(LV.brush, this._sfxBus);
    const w0 = this._live(this._noise(this._buf.white));
    B.stroke = this._g(0);
    const hp = this._f('highpass', 800, 0.7);
    B.bp = this._f('bandpass', 2000, 0.8);
    const blp = this._f('lowpass', 5200, 0.7);
    B.swish = this._g(0, B.out);
    w0.connect(B.stroke);
    B.stroke.connect(hp);
    hp.connect(B.bp);
    B.bp.connect(blp);
    blp.connect(B.swish);
    B.sbp = this._f('bandpass', 850, 1.1);
    B.scrape = this._g(0, B.out);
    B.stroke.connect(B.sbp);
    B.sbp.connect(B.scrape);
    const lfo = this._osc('sine', 3.2);
    lfo.setPeriodicWave(this._strokeWave);
    B.lfo = this._live(lfo);
    B.lfoG = this._g(0, B.stroke.gain);
    B.lfo.connect(B.lfoG);
    B.gs1 = this._live(this._noise(this._buf.grit));
    B.gs2 = this._live(this._noise(this._buf.grit2));
    B.g1 = this._g(0);
    B.g2 = this._g(0);
    B.gs1.connect(B.g1);
    B.gs2.connect(B.g2);
    const pk1 = this._f('peaking', 2200, 4);
    pk1.gain.value = 6;
    const pk2 = this._f('peaking', 3600, 5);
    pk2.gain.value = 3;
    const glp = this._f('lowpass', 5000, 0.7);
    B.g1.connect(pk1);
    B.g2.connect(pk1);
    pk1.connect(pk2);
    pk2.connect(glp);
    glp.connect(B.out);
    B.bronze = this._g(0, B.out);
    B.res = [];
    if (w >= 0) {
      const ex = this._g(1);
      B.stroke.connect(ex);
      pk2.connect(ex);
      [[1, 1], [1.73, 0.6], [2.33, 0.4]].forEach(([r, amp]) => {
        const f = WHEEL_F1[w] * r;
        const g = this._g(0, B.bronze);
        const bp = this._f('bandpass', f, 4, g);
        ex.connect(bp);
        B.res.push([bp, g, amp * Math.sqrt(300 / f)]);
        B.nodes.push(bp, g);
      });
      B.nodes.push(ex);
    }
    const pk = this._live(this._noise(this._buf.pink, 0.9));
    B.sed = this._g(0, B.out);
    const slp = this._f('lowpass', 700, 0.6, B.sed);
    pk.connect(slp);
    const br = this._live(this._noise(this._buf.brown, 1.3));
    B.water = this._g(0, B.out);
    const wlp = this._f('lowpass', 380, 0.6, B.water);
    br.connect(wlp);
    B.srcs = [w0, B.lfo, B.gs1, B.gs2, pk, br];
    B.nodes.push(B.stroke, hp, B.bp, blp, B.swish, B.sbp, B.scrape, B.lfoG, B.g1, B.g2, pk1, pk2, glp, B.bronze, B.sed, slp, B.water, wlp);
    this._brushL = B;
  }

  _brushTo(a, t, v, p) {
    const B = this._brushL;
    if (!B) return;
    const dt = B.tPrev >= 0 ? clamp$1(t - B.tPrev, 0, 0.1) : 0;
    B.tPrev = t;
    const hasV = !!v && typeof v === 'object' && Number.isFinite(v.x);
    let sp = 0;
    let rev = false;
    if (hasV) {
      const vy = v.y || 0, vz = v.z || 0;
      sp = Math.hypot(v.x, vy, vz);
      const pv = Math.hypot(B.vx, B.vy, B.vz);
      if (pv > 0.06 && sp > 0.02 && v.x * B.vx + vy * B.vy + vz * B.vz < 0 && t - B.lastRev > 0.08) rev = true;
      B.vx += (v.x - B.vx) * 0.35;
      B.vy += (vy - B.vy) * 0.35;
      B.vz += (vz - B.vz) * 0.35;
    }
    B.stillT = hasV && sp > 0.02 ? 0 : B.stillT + dt;
    const lfoOn = a > 0.01 && (!hasV || B.stillT > 0.3);
    if (typeof p === 'number' && Number.isFinite(p)) {
      const pp = clamp$1(p, 0, 1);
      if (B.p >= 0 && dt > 0) B.rate += (Math.max(0, pp - B.p) / dt - B.rate) * Math.min(1, dt / 0.4);
      while (B.miles < 3 && pp >= [0.35, 0.65, 0.9][B.miles]) { B.miles++; if (B.p >= 0 && a > 0.01) this._brushMile(); }
      B.p = pp;
      B.c = 1 - pp;
    }
    const c = B.c;
    const s = clamp$1(sp / 0.5, 0, 1);
    if (rev && a > 0.03) this._brushRev(t, B, a);
    const stop = a === 0 && B.a !== 0;
    const changed = Math.abs(a - B.a) > 0.005 || Math.abs(s - B.sp) > 0.01 || lfoOn !== B.lfoOn || stop;
    if (!changed || (t - B.setAt < 0.03 && !stop && lfoOn === B.lfoOn)) {
      if (a >= 0.003) B.idleAt = 0;
      return;
    }
    B.setAt = t;
    B.a = a;
    B.sp = s;
    const sE = lfoOn ? 0.45 + 0.35 * a : s;
    const env = a > 0.003 ? (lfoOn ? 0.62 : 0.35 + 0.65 * s) : 0;
    setp(B.stroke.gain, env, t, env > B.env ? 0.025 : 0.06);
    B.env = env;
    if (lfoOn !== B.lfoOn) { B.lfoOn = lfoOn; setp(B.lfoG.gain, lfoOn ? 0.38 : 0, t, 0.08); }
    if (lfoOn) setp(B.lfo.frequency, 2.8 + 2.2 * a, t, 0.25);
    setp(B.swish.gain, 0.68 * a, t, 0.035);
    setp(B.bp.frequency, clamp$1((1900 + 1650 * sE) * (1 + 0.25 * (1 - c)) * B.fc, 850, 4600), t, 0.06);
    setp(B.scrape.gain, 0.36 * a * (0.15 + 0.85 * sE) * (0.6 + 0.4 * c), t, 0.04);
    setp(B.sbp.frequency, clamp$1((650 + 700 * sE) * B.fc, 500, 1600), t, 0.06);
    const D = 150 + 1200 * sE * a * c;
    const x = clamp$1((D - 260) / 840, 0, 1);
    const gg = 0.48 * a * Math.sqrt(Math.max(0.02, c));
    setp(B.g1.gain, gg * (1 - x), t, 0.04);
    setp(B.g2.gain, gg * x * 0.9, t, 0.04);
    setp(B.gs1.playbackRate, 0.8 + 0.5 * sE, t, 0.1);
    setp(B.gs2.playbackRate, 0.8 + 0.5 * sE, t, 0.1);
    if (B.res.length) {
      const q = 3.5 + 2.5 * (1 - c);
      if (Math.abs(q - B.q) > 0.1) {
        B.q = q;
        for (const [bp, g, k] of B.res) { setp(bp.Q, q, t, 0.3); setp(g.gain, 0.22 * q * k, t, 0.3); }
      }
      setp(B.bronze.gain, 0.72 * a * (1 - c) * (1 - c), t, 0.08);
    }
    setp(B.sed.gain, clamp$1(B.rate / 0.15, 0, 1) * 0.085 * (0.3 + 0.7 * a), t, 0.2);
    setp(B.water.gain, 0.05 * sE * a + 0.015 * Math.sqrt(a), t, 0.1);
    B.idleAt = a < 0.003 ? t : 0;
    if (a > 0.05 && t - this._brushDuckT > 0.25) { this._brushDuckT = t; this._duck(-8, -6, -6, 0.3, 1.5, 0.5); }
  }

  _brushRev(t, B, a) {
    B.lastRev = t;
    B.fc = rand(0.92, 1.08);
    const g = B.stroke.gain;
    hold(g, t);
    g.setTargetAtTime(0.25 * Math.max(0.2, B.env), t, 0.006);
    g.setTargetAtTime(Math.max(0.2, B.env), t + 0.035, 0.02);
    this._nb(t + 0.004, 3500, 1.2, 0.05 * a, 0.002, 0.01, B.out, null, { buf: this._buf.grit });
  }

  _brushMile() {
    this.crack(1);
  }


  clack(strength = 1, pitch = 1, kind) {
    this._run(() => {
      const now = this._ctx.currentTime;
      const I = clamp$1(num(strength, 1), 0, 2);
      const P = clamp$1(num(pitch, 1), 0.3, 3);
      if (I < 0.01 || !this._room(3)) return;
      const heavy = kind === 'plate' || kind === 'case' || kind === 'pillar' || kind === 'crank' || (!kind && I >= 0.98);
      const wet = kind ? (heavy ? 0.85 : 0.75) : 1;
      const t = now + 0.004;
      const stacked = now - this._lastClack < 0.03;
      this._lastClack = now;
      const L = LV.clack * (stacked ? 0.65 : 1);
      const ti = t + (heavy ? 0.035 : 0.025);
      const n = kind === 'dialSet' ? 3 + ((Math.random() * 3) | 0) : 1;
      const bk0 = this._take(heavy ? 'clackH' : 'clack');
      if (bk0) {
        const Im = Math.min(I, 1);
        const br = (heavy ? P / CLACK_HP : (P * (1.12 - 0.22 * Im)) / (1.12 - 0.22 * CLACK_I)) * wet;
        const bg = (stacked ? 0.65 : 1) * (heavy ? 1 : (0.3 + 0.45 * Im) / (0.3 + 0.45 * CLACK_I));
        let tk = now;
        for (let j = 0; j < n; j++) {
          this._play(j ? this._take('clack') : bk0, bg * (j ? rand(0.4, 0.7) : 1), br * rand(0.95, 1.06), undefined, null, tk);
          tk += rand(0.02, 0.06);
        }
      } else {
        this._clackLive(I, P, heavy, wet, t, ti, L);
        for (let j = 1; j < n; j++) this._clackLive(I * rand(0.4, 0.7), P * rand(0.95, 1.1), false, wet, t + j * 0.04, ti + j * rand(0.03, 0.06), L);
      }
      const S = this._swell;
      if (S) {
        if (S.seated > 0 && this._room(1, true)) {
          const s = this._src(this._buf.clinks);
          s.playbackRate.value = rand(0.45, 0.55);
          const g = this._g(0.06 * S.charge * LV.clack, this._sfxBus);
          const lp = this._f('lowpass', 1500, 0.7, g);
          s.connect(lp);
          this._fire(s, ti + 0.008, ti + 1, [lp, g], ((Math.random() * CLINK_N) | 0) * CLINK_SLOT);
        }
        this._swellSeat(I, ti);
      }
    });
  }

  _clackLive(I, P, heavy, wet, t, ti, L) {
    {
      const pan = this._pan(heavy ? rand(-0.15, 0.15) : rand(-0.5, 0.5), this._sfxBus);
      const send = this._g(heavy ? 0.25 : 0.15, this._reverb);
      pan.connect(send);
      const G = this._grp(pan, send);
      const w = this._noise(this._buf.white);
      const es = this._g(0, pan);
      es.gain.setValueAtTime(0, t);
      es.gain.linearRampToValueAtTime((heavy ? 0.1 : 0.07) * Math.min(I, 1) * L, ti - 0.002);
      es.gain.setTargetAtTime(0, ti, 0.012);
      const fs = (heavy ? 700 : 1300) * P;
      const bs = this._f('bandpass', fs, 1.5, es);
      bs.frequency.setValueAtTime(fs * 0.8, t);
      bs.frequency.linearRampToValueAtTime(fs, ti);
      w.connect(bs);
      this._fire(w, t, ti + 0.1, [bs, es], undefined, G);
      const nv = heavy ? THUNK_N : CLINK_N;
      const slot = heavy ? THUNK_SLOT : CLINK_SLOT;
      const s = this._src(heavy ? this._buf.thunks : this._buf.clinks);
      const rate = (heavy ? (P / 0.75) * rand(0.95, 1.05) : P * (1.12 - 0.22 * Math.min(I, 1)) * rand(0.95, 1.05)) * wet;
      s.playbackRate.value = rate;
      const g = this._g((heavy ? 0.9 : 0.3 + 0.45 * Math.min(I, 1)) * L, pan);
      s.connect(g);
      this._fire(s, ti, ti + slot / rate, [g], ((Math.random() * nv) | 0) * slot, G);
      if (heavy) {
        const gr = this._noise(this._buf.grit);
        const eg = this._env(ti, 0.25 * L, 0.004, 0.15, pan);
        const bg = this._f('bandpass', 1200, 0.8, eg);
        gr.connect(bg);
        this._fire(gr, ti, ti + 1.2, [bg, eg], undefined, G);
      }
      this._seal(G);
    }
  }

  assembleSwell() {
    this._run(() => {
      if (this._swell) return;
      const t = this._ctx.currentTime + 0.03;
      const L = LV.swell;
      const S = this._swellPre || this._swellBuild();
      this._swellPre = null;
      S.t0 = t;
      S.out.gain.setValueAtTime(0, t);
      S.out.gain.linearRampToValueAtTime(L, t + 3.5);
      S.lp.frequency.setValueAtTime(300, t);
      S.lp.frequency.linearRampToValueAtTime(700, t + 3.5);
      if (!this._baked1('swellIn')) this._swellIntro(t, L, S.fx);
      this._swell = S;
    });
  }

  _swellIntro(t, L, dest) {
    [62, 69, 74, 76, 81].forEach((m, k) => this._bell(t + 0.6 + k * 0.5, mtof(m), 0.06 * L,
      { dest, pan: -0.5 + 0.25 * k, dur: 2.5, lp: 2600, low: true }));
    this._boom(t, 0.1 * L, dest);
  }

  _prebuildSwell() {
    if (this._swell || this._swellPre || this._baking) return;
    idle().then(() => this._run(() => { if (!this._swell && !this._swellPre) this._swellPre = this._swellBuild(); }));
  }

  _swellBuild() {
    {
      const S = { t0: 0, seated: 0, charge: 0, next: 0, lastSeat: 0, srcs: [], nodes: [] };
      S.out = this._g(0, this._musicBus);
      S.fx = this._g(1, this._musicBus);
      const s1 = this._g(0.5, this._reverb);
      const s2 = this._g(0.55, this._reverb);
      S.out.connect(s1);
      S.fx.connect(s2);
      S.lp = this._f('lowpass', 300, 1.2, S.out);
      [[50, 'sawtooth', 0.05, -6], [57, 'sawtooth', 0.04, 5], [64, 'triangle', 0.05, -3], [69, 'triangle', 0.035, 4]].forEach(([m, type, lv, det]) => {
        const o = this._osc(type, mtof(m));
        o.detune.value = det;
        const g = this._g(lv, S.lp);
        o.connect(g);
        S.srcs.push(this._live(o));
        S.nodes.push(g);
      });
      S.shim = this._g(1, S.out);
      const am = this._g(0.7, S.shim);
      const n = this._live(this._noise(this._buf.pink));
      const hp = this._f('highpass', 450, 0.7);
      n.connect(hp);
      const trim = this._g(0.55);
      hp.connect(trim);
      const bps = [587.33, 880, 1174.66, 1318.51].map((f) => {
        const bp = this._f('bandpass', f, 14, am);
        trim.connect(bp);
        return bp;
      });
      const tr = this._live(this._osc('sine', 0.27));
      const md = this._mod(tr, 0.3, am.gain);
      S.srcs.push(n, tr);
      S.nodes.push(S.lp, S.shim, am, hp, trim, md, s1, s2, S.fx, ...bps);
      return S;
    }
  }

  _swellSeat(I, t) {
    const S = this._swell;
    if (!S) return;
    const now = this._ctx.currentTime;
    S.seated++;
    S.charge = 1 - Math.exp(-S.seated / 14);
    const c = S.charge;
    hold(S.out.gain, now);
    S.out.gain.setTargetAtTime((1 + 0.1 * c) * LV.swell, now + 0.01, 0.8);
    hold(S.lp.frequency, now);
    S.lp.frequency.setTargetAtTime(700 + 2600 * c, now + 0.01, 1.2);
    setp(S.shim.gain, 1 + 2.5 * c, now, 1);
    if (t - S.lastSeat > 0.07) {
      S.lastSeat = t;
      this._bell(t + 0.01, mtof(MOTIF_BELL[(S.seated - 1) % 5] - 12), (0.05 + 0.07 * c * Math.min(I, 1)) * LV.swell,
        { dest: S.fx, pan: rand(-0.6, 0.6), dur: 2.2, lp: 2600, low: true });
    }
  }

  _swellEnd(t, quick) {
    const S = this._swell;
    if (!S) return;
    this._swell = null;
    const now = this._ctx.currentTime;
    if (!quick) {
      [[62, 0, 0.14], [69, 0.12, 0.1], [74, 0.28, 0.08]].forEach(([m, dt, g]) => this._bell(t + dt, mtof(m), g * LV.swell,
        { dest: S.fx, pan: rand(-0.3, 0.3), dur: 5, lp: 3000 }));
      this._air(t, 1.6, 0.012 * LV.swell, S.fx);
    } else {
      hold(S.fx.gain, now);
      S.fx.gain.setTargetAtTime(0, now, 0.1);
    }
    hold(S.out.gain, now);
    S.out.gain.setTargetAtTime(0, t + (quick ? 0 : 0.6), quick ? 0.12 : 1.1);
    this._retire(S, t + (quick ? 1 : 8));
  }

  wrong() {
    if (this._baked1('wrong', rand(0.9, 1.1), rand(0.96, 1.04))) return;
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const L = LV.wrong;
      const out = this._g(1, this._sfxBus);
      const G = this._grp(out);
      const kind = WRONG_K++ % 3;
      const sp = rand(0.7, 1.35);
      const tk = t + 0.03 / sp;
      const w = this._noise(this._buf.white);
      const bs = this._f('bandpass', [1800, 2500, 1300][kind] * rand(0.9, 1.1), [3, 2, 4][kind]);
      const es = this._g(0, out);
      es.gain.setValueAtTime(0, t);
      es.gain.linearRampToValueAtTime(0.25 * L * sp, tk);
      es.gain.setTargetAtTime(0, tk, 0.01);
      w.connect(bs);
      bs.connect(es);
      this._fire(w, t, tk + 0.08, [bs, es], undefined, G);
      let tr = tk + 0.03;
      this._nb(tk, [1300, 1700, 1100][kind] * rand(0.92, 1.08), 1.2, [0.14, 0.12, 0.16][kind] * L, 0.001, rand(0.008, 0.014), out, G);
      const tb = tr + rand(0.02, 0.12);
      const sd = rand(0.2, 0.4);
      const w2 = this._noise(this._buf.white);
      const b2 = this._f('bandpass', rand(1100, 2000), 2.5);
      const e2 = this._g(0, out);
      e2.gain.setValueAtTime(0, tb);
      e2.gain.linearRampToValueAtTime(0.1 * L, tb + 0.3 * sd);
      e2.gain.linearRampToValueAtTime(0, tb + sd);
      w2.connect(b2);
      b2.connect(e2);
      this._fire(w2, tb, tb + sd + 0.02, [b2, e2], undefined, G);
      this._seal(G);
    });
  }

  setCrank(speed01, months, angle) {
    this._run(() => {
      const s = clamp$1(num(speed01, 0), 0, 1);
      this._crank = s;
      if (!this._crankL) {
        if (s < 0.005) return;
        this._crankBuild();
      }
      const now = this._ctx.currentTime;
      if (Number.isFinite(months) && Number.isFinite(angle)) this._crankTrack(this._crankL, now, months, angle);
      this._crankTo(s, now);
    });
  }

  _crankBuild() {
    const C = { s: -1, idleAt: 0, lastClick: 0, jit: 1, nextCreak: 0, tPrev: -1, mPrev: 0, thPrev: 0, v: 0, w: 0, P: 0, rSet: 0,
      hasAngle: false, n1: 0, n2: 0, ost: 0, chord: '', lastNote: -1, done: false, pSet: -1, turns: 0, gT: 0, srcs: [], nodes: [] };
    C.out = this._g(0, this._sfxBus);
    const w = this._live(this._noise(this._buf.white));
    C.bp1 = this._f('bandpass', 500, 1.3);
    const g1 = this._g(0.3);
    C.whir = this._g(0.5, C.out);
    w.connect(C.bp1);
    C.bp1.connect(g1);
    g1.connect(C.whir);
    C.m1 = this._live(this._osc('sine', 20));
    C.m1.setPeriodicWave(this._meshWave);
    C.m2 = this._live(this._osc('sine', 11));
    C.m2.setPeriodicWave(this._meshWave);
    C.whine = this._g(0, C.out);
    const bank = [];
    [[C.m1, WHEEL_F1[0], [[1, 1], [1.73, 0.6], [2.33, 0.4]]], [C.m2, WHEEL_F1[1], [[1, 0.7], [1.73, 0.4]]]].forEach(([o, f1, rs]) => {
      for (const [r, a] of rs) {
        const g = this._g(a * 2.5 * Math.sqrt(300 / (f1 * r)), C.whine);
        const bp = this._f('bandpass', f1 * r, 8, g);
        o.connect(bp);
        bank.push(bp, g);
      }
    });
    const cw = this._live(this._noise(this._buf.white, 1.1));
    const cbp = this._f('bandpass', 2200, 2);
    C.chatAM = this._g(0.4);
    const chat = this._g(0.18, C.whine);
    cw.connect(cbp);
    cbp.connect(C.chatAM);
    C.chatAM.connect(chat);
    const cm = this._mod(C.m1, 0.6, C.chatAM.gain);
    C.ecc = this._live(this._osc('sine', 0.1));
    const em = this._mod(C.ecc, 0.15, C.whine.gain);
    const b = this._live(this._noise(this._buf.brown));
    C.rlp = this._f('lowpass', 150, 0.8);
    C.rumble = this._g(0, C.out);
    b.connect(C.rlp);
    C.rlp.connect(C.rumble);
    const gp = this._live(this._noise(this._buf.pink, 0.9));
    C.glove = this._g(0, this._suitBus);
    const gbp = this._f('bandpass', 800, 1.2, C.glove);
    gp.connect(gbp);
    C.ratchetG = this._g(0.5, C.out);
    C.taps = this._taps(C.ratchetG, RATCHET_PANS, RATCHET_GAINS);
    C.srcs = [w, C.m1, C.m2, cw, C.ecc, b, gp];
    C.nodes = [C.bp1, g1, C.whir, C.whine, ...bank, cbp, C.chatAM, chat, cm, em, C.rlp, C.rumble, C.glove, gbp, C.ratchetG, ...C.taps];
    this._crankL = C;
  }

  _crankTo(s, t) {
    const C = this._crankL;
    if (!C) return;
    const v = Math.abs(C.v);
    const r1 = 18.1 * v;
    if (Math.abs(s - C.s) < 0.004 && Math.abs(r1 - C.rSet) < 0.3 && !(s === 0 && C.s !== 0)) return;
    const tc = s > C.s ? 0.06 : 0.15;
    C.s = s;
    C.rSet = r1;
    const on = s > 0.005 ? 1 : 0;
    setp(C.out.gain, on * LV.crank * (0.35 + 0.65 * Math.sqrt(s)), t, tc);
    setp(C.bp1.frequency, 480 + 1400 * s, t, tc);
    setp(C.rlp.frequency, 150 + 250 * s, t, tc);
    setp(C.rumble.gain, 0.22 * s, t, tc);
    if (C.hasAngle) {
      const x = clamp$1((r1 - 20) / 10, 0, 1);
      setp(C.m1.frequency, Math.max(1, r1), t, 0.05);
      setp(C.m2.frequency, Math.max(1, 0.57 * r1), t, 0.05);
      setp(C.whine.gain, LV.mesh * x * Math.pow(Math.min(1, v / 32), 0.6), t, 0.08);
      setp(C.ecc.frequency, Math.max(0.02, v / 12.4), t, 0.2);
      setp(C.whir.gain, 0.25, t, 0.2);
    }
    C.idleAt = on ? 0 : t;
  }

  _crankTrack(C, now, m, th) {
    if (C.tPrev < 0 || now - C.tPrev > 0.5) { C.tPrev = now; C.mPrev = m; C.thPrev = th; C.hasAngle = true; return; }
    const dt = now - C.tPrev;
    if (dt < 1e-4) return;
    C.v += ((m - C.mPrev) / dt - C.v) * Math.min(1, dt / 0.1);
    C.w += (Math.abs(th - C.thPrev) / dt / (2 * Math.PI) - C.w) * Math.min(1, dt / 0.1);
    C.P = clamp$1(m / 223, 0, 1);
    const dth = th - C.thPrev;
    if (Math.abs(dth) > 1e-6) {
      const step = Math.PI / 6;
      const a = C.thPrev / step;
      const b = th / step;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let k = Math.floor(lo) + 1; k <= hi && k - lo < 24; k++) {
        const tk = Math.max(now + 0.004, C.tPrev + 0.03 + ((k - a) / (b - a)) * dt);
        const kk = ((k % 12) + 12) % 12;
        this._pawl(tk, C, kk);
        if (dth > 0 && kk % 6 === 0) this._ostinato(tk, C, kk === 0);
      }
    }
    const mi = Math.floor(m + 1e-6);
    const mp = Math.floor(C.mPrev + 1e-6);
    for (let k = mp + 1; k <= mi && k - mp <= 3; k++) if (Math.abs(C.v) < 6 || k >= 209) this._detent(now + 0.02, C, k);
    C.tPrev = now;
    C.mPrev = m;
    C.thPrev = th;
    if (now - C.gT > 0.03) {
      C.gT = now;
      setp(C.glove.gain, C.w > 0.1 ? 0.035 * LV.crank * Math.abs(Math.sin(th)) * clamp$1(C.w / 0.85, 0, 1) : 0, now, 0.05);
    }
  }

  _pawl(t, C, kk) {
    if (!this._room(1, true)) return;
    const src = this._src(this._buf.ratchet);
    src.playbackRate.value = rand(0.97, 1.03) * (0.94 + 0.12 * this._crank);
    const g = this._g(LV.ratchet * rand(0.8, 1.25) * (kk === 0 ? 1.25 : 1), pick(C.taps));
    src.connect(g);
    this._fire(src, t, t + 0.06, [g], 0);
  }

  _ostinato(t, C, full) {
    if (C.done || this._stage !== 'crank') return;
    const P = C.P;
    const idx = C.ost++;
    const vel = (0.5 + 0.2 * clamp$1(C.w / 0.85, 0, 1)) * LV.ost;
    this._lyre(t, MOTIF_BASS[idx % 5], vel, -0.15, { decay: 1.3 });
    if (P >= 0.75) this._lyre(t + 0.004, MOTIF_LYRE[idx % 5] + 12, 0.35 * vel, 0.3, { decay: 1.1 });
    const H = (CRANK_HARM.find(([p]) => P < p) || CRANK_HARM[CRANK_HARM.length - 1])[1];
    const ch = H[Math.floor(idx / 2) % H.length];
    if (ch !== C.chord) { C.chord = ch; this._padChord(t, PAD_V[ch]); }
    C.lastNote = t;
    if (P >= 0.35) this._drum(t, full ? 0.9 : P >= 0.9 ? 0.75 : 0.4, P);
    if (full) this._handleCreak(t, this._crank, C);
    if (P >= 0.55 && full && C.turns++ % 2 === 0) this._choir(t, [50, 57], 0.035 * LV.ost, 2.2, P >= 0.9 ? 'oh' : 'oo', this._musicBus);
  }

  _detent(t, C, k) {
    const last = k >= 209;
    this._tooth(t, 2, (last ? 0.45 : 0.18) * LV.teeth, pick(C.taps), null, last);
  }

  glyph(kind) {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (!this._room(1, true)) return;
      const GL = (this._glyphs = (this._glyphs || []).filter((x) => x > now - 1.2));
      if (GL.length >= 6) return;
      const busy = GL.filter((x) => x > now - 1).length >= 4;
      GL.push(now);
      this._glyphAlt = !this._glyphAlt;
      if (busy && this._glyphAlt) { this._clickAt(now + 0.005, 0.05 * LV.glyph, 1200, this._stingBus, 0.6); return; }
      const solar = kind === 'solar';
      const set = solar ? SOLAR : LUNAR;
      const paired = this._lastGlyph >= 0 && now - this._lastGlyph < 0.15;
      let t = now + 0.005;
      let m;
      if (paired) {
        const prev = this._glyphMidi;
        let c = set.filter((x) => x > prev && CONS.includes(x - prev));
        if (!c.length) c = set.filter((x) => CONS.includes(Math.abs(x - prev)));
        m = c.length ? pick(c) : prev;
        t = Math.max(t, this._glyphT + 0.07);
      } else {
        const len = set.length;
        this._glyphIdx = (((this._glyphIdx + pick([-1, 1, 1, 2])) % len) + len) % len;
        m = set[this._glyphIdx];
      }
      const C = this._crankL;
      const pcs = C && C.chord && PAD_V[C.chord] ? PAD_V[C.chord].map(pc) : null;
      if (pcs) {
        const fit = set.filter((x) => pcs.includes(pc(x)));
        if (fit.length) m = fit.reduce((bst, x) => (Math.abs(x - m) < Math.abs(bst - m) ? x : bst), fit[0]);
      }
      this._lastGlyph = now;
      this._glyphT = t;
      this._glyphMidi = m;
      const g = 0.32 * LV.glyph * (paired ? 0.8 : 1);
      if (solar) this._bell(t, mtof(m), g, { dest: this._stingBus, pan: rand(-0.4, 0.4), send: 0.25, lp: 2600, tau: 0.14, low: true });
      else this._bell(t, mtof(m), g, { dest: this._stingBus, pan: rand(-0.35, 0.35), send: 0.22, lp: 2000, soft: true, tau: 0.17, low: true });
    });
  }


  eclipse(amount01) {
    this._run(() => {
      const a = clamp$1(num(amount01, 0), 0, 1);
      if (Math.abs(a - this._eclA) < 0.003 && (a > 0 || this._eclA === 0)) return;
      const now = this._ctx.currentTime;
      if (a > 0 && !this._ecl) this._buildEclipse();
      this._eclA = a;
      if (a === 0) this._eclIdle = now;
      setp(this._ambDuck.gain, 1 - 0.85 * a, now, 0.25);
      const E = this._ecl;
      if (!E) return;
      setp(E.out.gain, 0.18 * Math.pow(a, 1.5), now, 0.25);
      setp(E.f1.frequency, 380 + 370 * a, now, 0.5);
      setp(E.f2.frequency, 760 + 420 * a, now, 0.5);
      setp(E.f3.frequency, 2450 + 350 * a, now, 0.5);
      setp(E.shim.gain, 0.035 * smooth(clamp$1((a - 0.7) / 0.3, 0, 1)), now, 0.6);
    });
  }

  diamondRing() {
    if (!this._baked1('ring')) this._ringChord();
    this._run(() => {
      if (this._modeOn !== 'underwater') return;
      const t = this._ctx.currentTime + 0.02;
      const G2 = this._grp();
      const b = this._noise(this._buf.brown);
      const lp = this._f('lowpass', 250, 0.7);
      const am = this._g(0.6);
      const e = this._g(0, this._plungeBus);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.6 * LV.eclipse, t + 0.12);
      e.gain.setTargetAtTime(0, t + 0.15, 0.12);
      b.connect(lp);
      lp.connect(am);
      am.connect(e);
      const fl = this._osc('sine', 12);
      const fd = this._g(0.4, am.gain);
      fl.connect(fd);
      this._fire(b, t, t + 1, [lp, am, e], undefined, G2);
      this._fire(fl, t, t + 1, [fd], undefined, G2);
      this._seal(G2);
    });
  }

  _ringChord() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.02;
      const out = this._g(0.45 * LV.eclipse, this._stingBus);
      const send = this._g(0.85, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const chord = [38, 45, 50, 57, 64, 69, 74];
      this._bloom(t, chord, 4, 0.04, out, G);
      chord.forEach((m, k) => this._lyre(t + k * 0.024, m < 50 ? m + 12 : m, 0.4 + 0.03 * k, -0.6 + 0.2 * k, { dest: out, decay: 2, grp: G }));
      this._bell(t + 0.04, mtof(74), 0.2, { dest: out, pan: -0.2, lp: 2600, tau: 1.1, grp: G });
      this._bell(t + 0.1, mtof(81), 0.14, { dest: out, pan: 0.1, lp: 2600, tau: 1, grp: G });
      this._bell(t + 0.16, mtof(76), 0.11, { dest: out, pan: 0.3, lp: 2600, tau: 0.9, grp: G });
      for (let i = 0; i < 5; i++) {
        this._bell(t + 0.15 + Math.random() * 1.4, mtof(pick([81, 86, 88])), rand(0.03, 0.05),
          { dest: out, pan: rand(-0.8, 0.8), lp: 2000, tau: 0.25, low: true, grp: G });
      }
      this._air(t, 1.2, 0.028, out, G);
      this._thud(t, 45, 0.3, 0.012, 0.4, out, G, 1.4, 0.3, this._beaconWave);
      this._seal(G);
    });
  }


  beacon() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const L = LV.beacon;
      this._pulse0 = 0;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.3, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      this._thud(t, 55, 0.9 * L, 0.006, 0.15, out, G, 1.3, 0.05, this._beaconWave);
      this._nb(t, 1500, 1, 0.1 * L, 0.01, 0.2, out, G, { buf: this._buf.pink });
      this._seal(G);
      const mb = this._g(1, this._stingBus);
      const G2 = this._grp(mb);
      this._bell(t + 0.2, mtof(50), 0.3 * L, { dest: mb, lp: 1500, dur: 4, pan: -0.1, grp: G2 });
      this._bell(t + 0.7, mtof(57), 0.24 * L, { dest: mb, lp: 1500, dur: 4, pan: 0.15, grp: G2 });
      this._seal(G2);
    });
  }

  pulse(d) {
    this._run(() => {
      if (!this._oscRoom(1) || !this._room(1)) return;
      const t = this._ctx.currentTime + 0.01;
      const dd = Math.max(0, num(d, 5));
      if (!this._pulse0) this._pulse0 = Math.max(dd, 1);
      const k = clamp$1(1 - dd / this._pulse0, 0, 1);
      const L = LV.pulse * (0.5 + 0.5 * k);
      const o = this._osc('sine', mtof(38));
      o.setPeriodicWave(this._pulseWave);
      const e = this._g(0, this._musicBus);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.3 * L, t + 0.25);
      e.gain.setTargetAtTime(0, t + 0.25, 0.5);
      o.connect(e);
      this._fire(o, t, t + 3, [e]);
      const S = this._swell;
      if (S) { hold(S.lp.frequency, t); S.lp.frequency.setTargetAtTime(Math.max(700 + 800 * k, 700 + 2600 * S.charge), t, 0.8); }
    });
  }

  slotCall(w) {
    this._run(() => {
      const i = clamp$1(Math.round(num(w, 2)), 0, 2);
      this._bell(this._ctx.currentTime + 0.02, mtof(WHEEL_BELL[i]), 0.165 * LV.slot, { dest: this._stingBus, lp: 1500, tau: 0.3, soft: true, pan: rand(-0.15, 0.15), send: 0.35 });
    });
  }

  align(w) {
    this._run(() => {
      const i = clamp$1(Math.round(num(w, 2)), 0, 2);
      const L = LV.align;
      const pan = this._pan(rand(-0.15, 0.15), this._sfxBus);
      const G = this._grp(pan);
      const n = 5 + ((Math.random() * 3) | 0);
      let t = this._ctx.currentTime + 0.01;
      for (let j = 0; j < n; j++) {
        this._tooth(t, i, 0.35 * L * rand(0.85, 1.15), pan, G, true);
        t += (0.06 - (0.035 * j) / (n - 1)) * rand(0.9, 1.1);
      }
      this._clickAt(t + 0.01, 0.3 * L, 800, pan, 0.6, G);
      this._seal(G);
    });
  }

  heroSeat(w, rockDur) {
    const i = clamp$1(Math.round(num(w, 2)), 0, 2);
    const D = clamp$1(num(rockDur, 1.6), 0.3, 4);
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      if (!this._play(this._take('hero' + i), 1, rand(0.985, 1.015))) this._heroCore(i);
      const seated = this._heroSeated.slice();
      this._heroSeated.push(i);
      this._heroN++;
      this._asmLyre = false;
      const G = this._grp();
      seated.forEach((j, k) => this._wheel(t + 0.04 + rand(0.005, 0.015) + k * 0.004, j, 0.12 * LV.hero, this._sfxBus, G, 1, true));
      this._seal(G);
      this._duck(-3, -2, -3, 0.01, 0.4, 0.5);
      this._bell(t + 0.05, mtof(WHEEL_BELL[i] - 12), 0.34 * LV.hero, { dest: this._stingBus, lp: 1600, tau: 0.25, pan: rand(-0.1, 0.1), send: 0.35 });
      this._rockLive = { i, last: this._heroN >= 3, k: 0, turned: false, done: false };
      this._rockPend = { at: t + 0.35, q: [] };
      const N = 10;
      const t0 = t + 0.3;
      const q = this._rockPend.q;
      for (let j = 1; j <= N; j++) {
        const tau = Math.asin(Math.sqrt(j / N)) / Math.PI;
        q.push([t0 + tau * D, i, 0.3 * rand(0.85, 1.1), j % 2 ? 0.15 : -0.15]);
        q.push([t0 + (1 - tau) * D, i, 0.26 * rand(0.85, 1.1), j % 2 ? -0.15 : 0.15]);
      }
      q.push([t0 + 0.5 * D, -1, 0.35, 0]);
      if (this._heroN >= 3) { q.push([t0 + 0.5 * D, -2, 83, 0]); q.push([t0 + D, -2, 81, 0]); }
      q.sort((a, b) => a[0] - b[0]);
    });
  }

  rock(x) {
    this._run(() => {
      const R = this._rockLive;
      if (!R || R.done) return;
      const now = this._ctx.currentTime;
      if (this._rockPend) this._rockPend = null;
      const u = clamp$1(num(x, 0), 0, 1);
      const N = 10;
      const up = Math.pow(Math.sin(Math.PI * u), 2);
      const k = u <= 0.5 ? Math.floor(up * N + 1e-6) : N + Math.floor((1 - up) * N + 1e-6);
      const t = now + 0.005;
      for (let j = 0; j < 4 && R.k < k; j++) {
        R.k++;
        const back = R.k > N;
        this._tooth(t + j * 0.004, R.i, (back ? 0.26 : 0.3) * rand(0.85, 1.1) * LV.hero, this._rockTaps[(R.k + (back ? 1 : 0)) % 2], null);
      }
      if (!R.turned && u >= 0.5) {
        R.turned = true;
        this._clickAt(t, 0.3 * LV.hero, 700, this._rockTaps[1], 0.6);
        if (R.last) this._bell(t, mtof(71), 0.22 * LV.hero, { dest: this._stingBus, lp: 1600, tau: 0.3, send: 0.35, pan: 0.1 });
      }
      if (u >= 1) {
        R.done = true;
        if (R.last) this._bell(t, mtof(69), 0.22 * LV.hero, { dest: this._stingBus, lp: 1600, tau: 0.35, send: 0.35, pan: 0.1 });
      }
    });
  }

  _heroCore(i) {
    this._run(() => {
      const t = this._ctx.currentTime + 0.01;
      const L = LV.hero;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.2, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const w = this._noise(this._buf.grit);
      const bs = this._f('bandpass', 1100, 1.5);
      const es = this._g(0, out);
      es.gain.setValueAtTime(0, t);
      es.gain.linearRampToValueAtTime(0.9 * L, t + 0.035);
      es.gain.setTargetAtTime(0, t + 0.035, 0.008);
      w.connect(bs);
      bs.connect(es);
      this._fire(w, t, t + 0.12, [bs, es], undefined, G);
      const ts = t + 0.035;
      const f = i === 1 ? 110 : 70;
      this._thud(ts, f, (i === 1 ? 0.5 : 0.88) * L, 0.003, 0.08, out, G, 1.3, 0.04);
      this._nb(ts, 220, 2, 0.35 * L, 0.001, 0.035, out, G, { pri: true });
      this._wheel(ts + 0.002, i, 0.75 * L, out, G, 1, true);
      this._nb(ts + rand(0.025, 0.04), 1000, 1.5, 0.15 * L, 0.0005, 0.006, out, G, { pri: true });
      this._tooth(ts + 0.03, i, 0.4 * L, out, G, true);
      this._thud(ts + 0.03, f * 1.1, 0.3 * L, 0.002, 0.03, out, G, 1.1, 0.01);
      this._tooth(ts + 0.041, i, 0.14 * L, out, G, true);
      this._seal(G);
    });
  }

  _schedRock(now, h) {
    const P = this._rockPend;
    if (P && now > P.at) {
      this._rockPend = null;
      if (this._rockLive) this._rockLive.done = true;
      for (const e of P.q) this._rockQ.push(e);
      this._rockQ.sort((a, b) => a[0] - b[0]);
    }
    const Q = this._rockQ;
    while (Q.length && Q[0][0] < h) {
      const [t, w, g, pan] = Q.shift();
      if (t < now - 0.1) continue;
      const tt = Math.max(t, now + 0.003);
      if (w === -2) { this._bell(tt, mtof(g - 12), 0.22 * LV.hero, { dest: this._stingBus, lp: 1600, tau: g === 81 ? 0.35 : 0.3, send: 0.35, pan: 0.1 }); continue; }
      const tap = this._rockTaps[pan < 0 ? 0 : 1];
      if (w === -1) { this._clickAt(tt, 0.3 * LV.hero, 700, tap, 0.6); continue; }
      this._tooth(tt, w, g * LV.hero, tap, null);
    }
  }

  saros() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.005;
      const L = LV.saros;
      const out = this._g(1, this._sfxBus);
      const send = this._g(0.25, this._reverb);
      out.connect(send);
      const G = this._grp(out, send);
      const s = this._src(this._buf.ratchet);
      s.playbackRate.value = 0.7;
      const g = this._g(0.8 * L, out);
      s.connect(g);
      this._fire(s, t, t + 0.12, [g], 0, G);
      this._thud(t + 0.01, 110, 0.7 * L, 0.002, 0.05, out, G, 1.2, 0.02);
      this._nb(t + 0.01, 620, 2, 0.45 * L, 0.001, 0.025, out, G, { pri: true });
      this._nb(t + 0.012, 1300, 1.5, 0.1 * L, 0.0005, 0.01, out, G, { pri: true });
      for (const w of [2, 1, 0]) this._wheel(t + 0.02 + rand(0, 0.01), w, 0.4 * L, out, G, 1, true);
      [[62, 0.035, -0.25], [69, 0.045, 0.2], [72, 0.055, 0]].forEach(([m, dt, pan]) => this._bell(t + dt, mtof(m), 0.1 * L,
        { dest: out, pan, lp: 1500, tau: 0.5, soft: true, grp: G }));
      this._seal(G);
      this._duck(-6, 0, -3, 0.01, 0.6, 0.8);
      const C = this._crankL;
      if (C) C.done = true;
      setp(this._padGain.gain, 0, t, 0.1);
      this._prebuildRise();
    });
  }


  eclipseAt(alignT, flashDone) {
    this._run(() => {
      const a = num(alignT, -1);
      if (a < 0) return;
      const now = this._ctx.currentTime;
      let E = this._eclL;
      if (!E) { if (a > 2.5 || this._eclDone) return; E = this._eclBuild(now); }
      const L = LV.eclipse;
      if (!E.st1 && a >= 0.8) { E.st1 = true; setp(this._ambDuck.gain, 0.25, now, 0.5); }
      if (!E.st2 && a >= 1.4) { E.st2 = true; E.top.forEach((o) => o.frequency.setTargetAtTime(mtof(63), now, 0.15)); }
      if (!E.st3 && a >= 2.0) {
        E.st3 = true;
        E.top.forEach((o) => o.frequency.setTargetAtTime(mtof(62), now, 0.15));
        setp(E.choir.gain, 0, now, 0.15);
        setp(E.bow.gain, 0.3 * E.bowLv, now, 0.3);
        setp(E.cor.gain, 0.05 * L, now, 0.4);
      }
      if (!E.bead && a >= 2.82) {
        E.bead = true;
        this._bell(now + 0.005, mtof(74), 0.08 * L, { dest: this._stingBus, pan: 0.3, lp: 2200, tau: 0.35, soft: true });
        this._bell(now + 0.035, mtof(81), 0.04 * L, { dest: this._stingBus, pan: 0.35, lp: 2200, tau: 0.3, soft: true, low: true });
      }
      if (!E.flash && (flashDone || a >= 2.95)) {
        E.flash = true;
        if (this._rise && !this._rise.flashT) this._rise.flashT = now;
        this.diamondRing();
        const t = now + 0.02;
        hold(this._ambDuck.gain, t);
        this._ambDuck.gain.setTargetAtTime(0.5, t, 1.5);
        setp(E.cor.gain, 0, t, 1.5);
        setp(E.bow.gain, 0, t, 0.6);
        E.top.forEach((o) => o.frequency.setTargetAtTime(mtof(57), t, 0.1));
        E.F.forEach(([bp], k) => setp(bp.frequency, VOWELS.ah[k], t, 0.3));
        hold(E.choir.gain, t);
        E.choir.gain.setTargetAtTime(0.06 * L, t, 0.2);
        E.choir.gain.setTargetAtTime(0.015 * L, t + 0.6, 1.8);
        E.endAt = t + 9;
      }
    });
  }

  _eclBuild(now) {
    const E = { srcs: [], nodes: [], bowLv: 0.05 * LV.eclipse, endAt: 0 };
    const t = now + 0.02;
    E.out = this._g(1, this._musicBus);
    const send = this._g(0.5, this._reverb);
    E.out.connect(send);
    E.choir = this._g(0, E.out);
    const lp = this._f('lowpass', 3200, 0.5, E.choir);
    const mix = this._g(0.5);
    E.F = VOWELS.oo.map((f, k) => {
      const g = this._g([1.5, 0.8, 0.3][k], lp);
      const bp = this._f('bandpass', f, [4, 6, 9][k], g);
      mix.connect(bp);
      return [bp, g];
    });
    const vib = this._live(this._osc('sine', 4.9));
    const vd = this._g(7);
    vib.connect(vd);
    const voice = (m) => [-7, 7].map((det) => {
      const o = this._osc('sawtooth', mtof(m));
      o.detune.value = det;
      vd.connect(o.detune);
      o.connect(mix);
      E.srcs.push(this._live(o));
      return o;
    });
    voice(50);
    voice(57);
    E.top = voice(62);
    E.choir.gain.setValueAtTime(0, t);
    E.choir.gain.setTargetAtTime(0.07 * LV.eclipse, t, 0.4);
    const n = this._live(this._noise(this._buf.pink));
    E.bow = this._g(0, E.out);
    [50, 57, 62].forEach((m, k) => {
      const g = this._g([1, 0.7, 0.5][k] * 60, E.bow);
      const bp = this._f('bandpass', mtof(m), 60, g);
      n.connect(bp);
      E.nodes.push(g, bp);
    });
    E.bow.gain.setValueAtTime(0, t);
    E.bow.gain.linearRampToValueAtTime(E.bowLv, t + 1.5);
    const n2 = this._live(this._noise(this._buf.pink, 1.1));
    E.cor = this._g(0, this._stingBus);
    [5000, 7000].forEach((f) => {
      const g = this._g(6, E.cor);
      const bp = this._f('bandpass', f, 15, g);
      n2.connect(bp);
      E.nodes.push(g, bp);
    });
    E.srcs.push(vib, n, n2);
    E.nodes.push(send, E.choir, lp, mix, vd, E.bow, E.cor, ...E.F.flat());
    this._eclL = E;
    return E;
  }

  _prebuildRise() {
    if (this._rise || this._risePre || this._baking) return;
    idle().then(() => this._run(() => { if (!this._rise && !this._risePre) this._risePre = this._riseBuild(); }));
  }

  _riseStart(now) {
    if (this._rise || this._baking) return;
    const R = this._risePre || this._riseBuild();
    this._risePre = null;
    R.t0 = now;
    R.depth0 = this._lis.depth > 0.5 ? this._lis.depth : 0;
    R.u = 0;
    R.ch = -1;
    R.flashT = 0;
    R.chMin = 0;
    R.pDone = false;
    this._rise = R;
    this._riseTo(R, now);
  }

  _riseBuild() {
    const R = { u: 0, depth0: 0, t0: 0, ch: -1, s1: false, s2: false, hold: false, seq: null, voiced: false, breached: false,
      bT: 0, vLast: 0, flashT: 0, chMin: 0, pSet: 0, pDone: false, dawn: false, srcs: [], nodes: [] };
    R.out = this._g(0, this._musicBus);
    const send = this._g(0.45, this._reverb);
    R.out.connect(send);
    R.lp = this._f('lowpass', 400, 0.9);
    R.padG = this._g(0, R.out);
    R.lp.connect(R.padG);
    R.pad = RISE_CH[0][1].map((m, i) => {
      const p = this._pan([-0.4, -0.15, 0.1, 0.3, -0.25][i], R.lp);
      const vg = this._g(i === 0 ? 0.07 : 0.05, p);
      R.nodes.push(p, vg);
      return [-7, 7].map((det) => {
        const o = this._osc('sawtooth', mtof(m));
        o.detune.value = det;
        o.connect(vg);
        R.srcs.push(this._live(o));
        return o;
      });
    });
    const vm = this._g(0.5);
    R.voice = [-6, 6].map((det) => {
      const o = this._osc('sawtooth', mtof(62));
      o.detune.value = det;
      o.connect(vm);
      R.srcs.push(this._live(o));
      return o;
    });
    R.vEnv = this._g(0, R.out);
    const vlp = this._f('lowpass', 3500, 0.5, R.vEnv);
    R.f = VOWELS.oo.map((f, k) => {
      const gg = this._g([1.5, 0.8, 0.3][k], vlp);
      const bp = this._f('bandpass', f, [5, 7, 10][k], gg);
      vm.connect(bp);
      R.nodes.push(gg);
      return [bp, gg];
    });
    R.vib = this._live(this._osc('sine', 5));
    R.vibD = this._g(0);
    R.vib.connect(R.vibD);
    R.voice.forEach((o) => R.vibD.connect(o.detune));
    const n = this._live(this._noise(this._buf.pink));
    R.shim = this._g(0, R.out);
    const hp = this._f('highpass', 1000, 0.7);
    n.connect(hp);
    R.shimBP = [86, 93, 100].map((m) => {
      const g = this._g(8, R.shim);
      const bp = this._f('bandpass', mtof(m), 12, g);
      hp.connect(bp);
      R.nodes.push(g, bp);
      return bp;
    });
    R.sub = this._g(0, R.out);
    const sb = this._live(this._osc('sine', mtof(26)));
    const sb2 = this._live(this._osc('triangle', mtof(38)));
    const sg2 = this._g(0.6, R.sub);
    sb.connect(R.sub);
    sb2.connect(sg2);
    R.srcs.push(R.vib, n, sb, sb2);
    R.nodes.push(send, R.lp, R.padG, vm, R.vEnv, vlp, ...R.f.map((x) => x[0]), R.vibD, R.shim, hp, R.sub, sg2);
    return R;
  }

  _riseTo(R, now) {
    const u = R.u;
    const pT = R.flashT ? smooth(clamp$1((now - R.flashT - 0.3) / 1.6, 0, 1)) : 0;
    const sw = smooth(clamp$1((u - 0.05) / 0.9, 0, 1));
    setp(R.out.gain, LV.rise * Math.max(0.35 + 0.65 * sw, 0.7 * pT), now, 0.3);
    setp(R.padG.gain, Math.max(smooth(clamp$1((u - 0.05) / 0.25, 0, 1)), pT), now, 0.4);
    setp(R.lp.frequency, 400 + 2100 * Math.pow(u, 1.3), now, 0.3);
    const vw = clamp$1((u - 0.3) / 0.6, 0, 1);
    const F = vw < 0.5 ? lerpV(VOWELS.oo, VOWELS.oh, vw * 2) : lerpV(VOWELS.oh, VOWELS.ah, vw * 2 - 1);
    R.f.forEach(([bp], k) => setp(bp.frequency, F[k], now, 0.3));
    const wide = smooth(clamp$1((u - 0.7) / 0.2, 0, 1));
    setp(R.shim.gain, 0.05 * wide, now, 0.4);
    setp(R.sub.gain, 0.07 * wide, now, 0.5);
    let ci = 0;
    for (let k = 0; k < RISE_CH.length; k++) if (u >= RISE_CH[k][0]) ci = k;
    ci = Math.max(ci, R.chMin || 0);
    if (ci !== R.ch) {
      R.ch = ci;
      RISE_CH[ci][1].forEach((m, i) => R.pad[i].forEach((o) => o.frequency.setTargetAtTime(mtof(m), now + 0.02, 0.3)));
    }
    this._nearTo(now, 0.3);
  }

  _riseNote(R, m, t, first) {
    const f = mtof(m);
    for (const o of R.voice) { if (first) o.frequency.setValueAtTime(f, t); else o.frequency.setTargetAtTime(f, t, 0.05); }
    const g = R.vEnv.gain;
    const v = 0.14 * (0.6 + 0.4 * R.u);
    if (first) { g.setValueAtTime(0, t); g.linearRampToValueAtTime(v, t + 0.3); }
    else { g.setValueAtTime(R.vLast || v, t); g.linearRampToValueAtTime(v * 0.78, t + 0.04); g.linearRampToValueAtTime(v, t + 0.16); }
    R.vLast = v;
    R.vibD.gain.setValueAtTime(0, t);
    R.vibD.gain.setValueAtTime(0, t + 0.4);
    R.vibD.gain.linearRampToValueAtTime(12, t + 0.8);
    this._lyre(t, m - 12, 0.45, 0.2, { dest: R.out, decay: 1.6 });
  }

  _schedRise(now, h) {
    const E = this._eclL;
    if (E && E.endAt && now > E.endAt) {
      this._eclL = null;
      this._eclDone = true;
      setp(E.out.gain, 0, now, 0.3);
      setp(E.cor.gain, 0, now, 0.3);
      this._retire(E, now + 1.5);
      if (!this._rise || !this._rise.breached) setp(this._ambDuck.gain, 1, now, 2);
    }
    const R = this._rise;
    if (!R) return;
    if (R.breached) {
      if (!this._cue && now - R.bT > 60) { this._rise = null; setp(R.out.gain, 0, now, 1); this._retire(R, now + 5); }
      return;
    }
    if (!(R.depth0 > 0.5)) {
      const uT = clamp$1((now - R.t0 - 3.3) / 9, 0, 1);
      if (uT > R.u + 0.004) { R.u = uT; this._riseTo(R, now); }
    }
    const u = R.u;
    if (R.flashT && !R.pDone && now - R.pSet > 0.1) { R.pSet = now; if (now - R.flashT > 2.2) R.pDone = true; this._riseTo(R, now); }
    const Lis = this._lis;
    const tc = R.depth0 > 0.5 && Lis.vUp > 0.3 ? Lis.depth / Lis.vUp : Infinity;
    const near = R.depth0 > 0.5 ? Lis.depth < 1.5 : u >= 0.92;
    const S = R.seq;
    if (S) {
      while (S.i < S.notes.length && S.next < h) {
        if (S.two && near && S.i > 0) { S.i = S.notes.length; break; }
        const [m, d] = S.notes[S.i];
        const tn = Math.max(S.next, now + 0.01);
        this._riseNote(R, m, tn, !R.voiced);
        R.voiced = true;
        S.next = tn + d;
        S.i++;
      }
      if (S.i >= S.notes.length && now >= S.next - 0.05) {
        R.seq = null;
        if (S.two) R.s2 = true;
        else {
          R.s1 = true;
          R.seq = { notes: RISE_S2, i: 0, next: Math.max(S.next, now + 0.01), two: true };
          R.chMin = Math.max(R.chMin, 1);
          this._riseTo(R, now);
        }
      }
      return;
    }
    if (!R.s1) {
      if (R.flashT ? now >= R.flashT + 0.3 : u >= 0.1) R.seq = { notes: RISE_S1, i: 0, next: Math.max(now + 0.05, R.flashT + 0.4), two: false };
    } else if (R.s2 && !R.hold && (u >= 0.85 || near || tc < 1.2)) {
      R.hold = true;
      R.chMin = 4;
      this._riseTo(R, now);
      this._riseNote(R, 74, now + 0.02, !R.voiced);
      R.voiced = true;
    }
  }

  _risePad(R, notes, t, tc) {
    R.pad.forEach((pair, i) => {
      const f = mtof(notes[i]);
      for (const o of pair) { hold(o.frequency, t); o.frequency.setTargetAtTime(f, t, tc); }
    });
  }

  _breachMusic(now) {
    const t = now + 0.005;
    const BD = 0.24;
    const md = this._musicDip && this._musicDip.gain;
    if (md) { hold(md, t); md.setTargetAtTime(0.22, t, 0.012); md.setTargetAtTime(1, t + BD, 0.035); }
    const dg = this._droneGain.gain;
    hold(dg, t);
    dg.setTargetAtTime(0, t, 0.02);
    dg.setTargetAtTime(STAGES.eclipse.drone * 0.7, t + BD, 0.4);
    setp(this._ambDuck.gain, 1, t, 0.1);
    const R = this._rise;
    if (R && !R.breached) {
      R.breached = true;
      R.bT = now;
      R.seq = null;
      const pg = R.padG.gain;
      hold(pg, t);
      pg.setTargetAtTime(0.15, t, 0.02);
      pg.setTargetAtTime(1, t + BD, 0.2);
      RISE_OPEN.forEach((m, i) => R.pad[i].forEach((o) => { hold(o.frequency, t); o.frequency.setTargetAtTime(mtof(m), t + BD, 0.04); }));
      hold(R.lp.frequency, t);
      R.lp.frequency.setTargetAtTime(6000, t + BD, 0.2);
      for (const o of R.voice) { hold(o.frequency, t); o.frequency.setTargetAtTime(mtof(69), t + BD, 0.08); }
      R.f.forEach(([bp], k) => { hold(bp.frequency, t); bp.frequency.setTargetAtTime(VOWELS.ah[k], t + BD, 0.2); });
      hold(R.vEnv.gain, t);
      R.vEnv.gain.setTargetAtTime(0.1, t + BD, 0.15);
      hold(R.sub.gain, t);
      R.sub.gain.setTargetAtTime(0, t, 0.35);
      const og = R.out.gain;
      hold(og, t);
      og.setTargetAtTime(LV.rise, t + BD, 0.15);
      og.setTargetAtTime(0.5 * LV.rise, t + 3, 1.2);
    }
    const out = this._g(LV.breachMusic, this._musicBus);
    const send = this._g(0.4, this._reverb);
    out.connect(send);
    const G = this._grp(out, send);
    [50, 57, 62, 69, 74, 76].forEach((m, k) => this._lyre(t + BD + k * 0.025, m, 0.42 + 0.04 * k, -0.5 + 0.2 * k, { dest: out, decay: 2.4, grp: G }));
    this._bloom(t + BD, [38, 45, 50, 57, 62, 69, 74, 76], 3.5, 0.045, out, G);
    this._seal(G);
  }

  dawn(elDeg) {
    this._run(() => {
      const el = num(elDeg, -30);
      const now = this._ctx.currentTime;
      let Q = this._cue;
      if (!Q) {
        if (el < DAWN[0][0] || this._cueDone) return;
        Q = this._cueBuild(now);
        Q.step = -1;
        const R = this._rise;
        if (R && R.breached && !R.dawn) {
          R.dawn = true;
          const t1 = Math.max(now, R.bT + 2.5);
          for (const p of [R.out.gain, R.vEnv.gain, R.shim.gain, R.sub.gain]) hold(p, now);
          R.out.gain.setTargetAtTime(0.05 * LV.rise, t1, 1.5);
          R.vEnv.gain.setTargetAtTime(0, t1, 1.2);
          R.sub.gain.setTargetAtTime(0, t1, 1.5);
          R.shimBP.forEach((bp, i) => { hold(bp.frequency, t1); bp.frequency.setTargetAtTime(mtof([93, 98, 105][i]), t1, 1); });
          R.shim.gain.setTargetAtTime(0.01, t1, 1.5);
        } else if (R && !R.dawn) { this._rise = null; setp(R.out.gain, 0, now, 0.7); this._retire(R, now + 5); }
      }
      Q.last = now;
      if (Q.resolved) return;
      const Rv = this._rise && this._rise.dawn ? this._rise : null;
      const k = clamp$1((el + 12) / 11, 0, 1);
      if (Math.abs(k - Q.kSet) >= 0.004) {
        Q.kSet = k;
        setp(Q.out.gain, LV.sunrise * (0.35 + 0.5 * smooth(k)), now, 0.35);
        setp(Q.lp.frequency, 1100 + 5400 * Math.pow(k, 0.9), now, 0.5);
        if (Q.plp) setp(Q.plp.frequency, 4200 + 2500 * k, now, 0.5);
        setp(Q.droneG.gain, 0.05 + 0.05 * k, now, 0.8);
        if (Rv && now >= Rv.bT + 2.5) {
          setp(Rv.out.gain, LV.rise * (0.05 + 0.07 * smooth(k)), now, 0.8);
          setp(Rv.lp.frequency, 900 + 5100 * Math.pow(k, 1.1), now, 0.6);
          setp(Rv.shim.gain, 0.03 + 0.09 * smooth(k), now, 0.8);
        }
      }
      while (Q.step + 1 < DAWN.length && el >= DAWN[Q.step + 1][0]) {
        Q.step++;
        const [, pad, m] = DAWN[Q.step];
        const t = now + 0.03;
        if (pad) this._cuePad(Q, pad, t, 0.5);
        if (Rv && DAWN_RISE[Q.step]) this._risePad(Rv, DAWN_RISE[Q.step], Math.max(t, Rv.bT + 2.5), 0.6);
        this._cueNote(Q, m, t, 0.55 + 0.1 * k, Q.step === 0);
      }
      if (el >= EL_RIM) this._cueResolve(Q, now + 0.03);
    });
  }

  _cueNote(Q, m, t, vel, first) {
    const f = mtof(m);
    for (const o of Q.pipes) { if (first) o.frequency.setValueAtTime(f, t); else o.frequency.setTargetAtTime(f, t, 0.035); }
    Q.bp.frequency.setTargetAtTime(Math.min(f * 2.2, 6000), t, 0.03);
    for (const [p, s] of [[Q.penv.gain, 1], [Q.benv.gain, 0.28]]) {
      const v = vel * s;
      if (first) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + 0.18); }
      else { p.setValueAtTime(v, t); p.linearRampToValueAtTime(v * 0.7, t + 0.035); p.linearRampToValueAtTime(v, t + 0.1); }
    }
    Q.vibD.gain.setValueAtTime(0, t);
    Q.vibD.gain.linearRampToValueAtTime(12, t + 0.5);
    this._lyre(t, m + 12, 0.22, 0.25, { dest: Q.out, decay: 1.4 });
  }


  uiHover() {
    this._run(() => {
      const now = this._ctx.currentTime;
      if (now - this._lastHover < 0.05) return;
      this._lastHover = now;
      const t = now + 0.005;
      this._nb(t, rand(720, 860), 3.2, 0.24 * LV.ui, 0.001, 0.022, this._uiBus, null, { pri: true });
      this._nb(t + 0.002, 300, 1.8, 0.07 * LV.ui, 0.002, 0.022, this._uiBus, null, { pri: true, buf: this._buf.pink });
    });
  }

  uiClick() {
    this._run(() => {
      const t = this._ctx.currentTime + 0.005;
      this._nb(t, 820, 2.2, 0.5 * LV.ui, 0.001, 0.03, this._uiBus, null, { pri: true });
      this._nb(t, 1600, 1.5, 0.15 * LV.ui, 0.0005, 0.005, this._uiBus, null, { pri: true });
      this._thud(t, 120, 0.16 * LV.ui, 0.003, 0.05, this._uiBus, null, 1.3, 0.02);
      this._lyre(t + 0.008, 57, 0.34 * LV.ui, 0, { dest: this._uiBus, decay: 0.6 });
    });
  }


  sunrise(k) {
    this._run(() => {
      const K = clamp$1(num(k, 0), 0, 1);
      const now = this._ctx.currentTime;
      let Q = this._cue;
      if (!Q) {
        if (K < 0.002) { this._cueDone = false; return; }
        if (this._cueDone) return;
        Q = this._cueBuild(now);
      }
      Q.last = now;
      if (Q.resolved) return;
      if (Math.abs(K - Q.kSet) >= 0.004) {
        Q.kSet = K;
        setp(Q.out.gain, LV.sunrise * (0.3 + 0.7 * smooth(clamp$1(K / 0.9, 0, 1))), now, 0.35);
        setp(Q.lp.frequency, 450 + 3300 * Math.pow(K, 1.3), now, 0.5);
        setp(Q.droneG.gain, 0.05 + 0.05 * K, now, 0.8);
      }
      const seg = K < 0.25 ? 0 : K < 0.5 ? 1 : K < 0.75 ? 2 : 3;
      if (seg > Q.seg) {
        Q.seg = seg;
        Q.queue = [seg];
        this._cuePad(Q, SUN_CHORDS[seg], now + 0.05, 0.5);
      }
      if (K >= 0.97) this._cueResolve(Q, now + 0.03);
    });
  }

  _cueBuild(now) {
    const t = now + 0.02;
    const Q = { kSet: -1, seg: -1, queue: [], free: t + 0.1, last: now, resolved: false, endAt: 0, srcs: [], nodes: [] };
    Q.out = this._g(0, this._musicBus);
    const send = this._g(0.5, this._reverb);
    Q.out.connect(send);
    Q.lp = this._f('lowpass', 450, 0.8);
    const padG = this._g(1, Q.out);
    Q.lp.connect(padG);
    const ch = this._live(this._osc('sine', 0.19));
    const cu = this._g(6);
    const cd = this._g(-6);
    ch.connect(cu);
    ch.connect(cd);
    Q.srcs.push(ch);
    Q.nodes.push(send, Q.lp, padG, cu, cd);
    Q.pad = SUN_CHORDS[0].map((m, i) => {
      const p = this._pan([-0.35, -0.1, 0.15, 0.4][i], Q.lp);
      const vg = this._g(i === 0 ? 0.075 : 0.06, p);
      Q.nodes.push(p, vg);
      return [['sawtooth', -6, cu], ['triangle', 5, cd]].map(([type, det, mod]) => {
        const o = this._osc(type, mtof(m));
        o.detune.value = det;
        mod.connect(o.detune);
        o.connect(vg);
        Q.srcs.push(this._live(o));
        return o;
      });
    });
    Q.droneG = this._g(0.05, Q.out);
    const dlp = this._f('lowpass', 260, 0.7, Q.droneG);
    const dr = this._osc('sawtooth', mtof(38));
    dr.connect(dlp);
    Q.srcs.push(this._live(dr));
    Q.nodes.push(Q.droneG, dlp);
    const pm = this._g(1);
    const plp = this._f('lowpass', 2600, 0.6);
    Q.plp = plp;
    const pk = this._f('peaking', 1150, 1.3);
    pk.gain.value = 5;
    const pk2 = this._f('peaking', 2600, 2);
    pk2.gain.value = 4.5;
    Q.penv = this._g(0);
    const pp = this._pan(0.08, Q.out);
    pm.connect(plp);
    plp.connect(pk);
    pk.connect(pk2);
    pk2.connect(Q.penv);
    Q.nodes.push(pk2);
    Q.penv.connect(pp);
    Q.vibD = this._g(0);
    const vib = this._osc('sine', 5.1);
    vib.connect(Q.vibD);
    Q.srcs.push(this._live(vib));
    Q.pipes = [['sawtooth', 0.5], ['triangle', 0.5]].map(([type, lv]) => {
      const o = this._osc(type, mtof(57));
      const g = this._g(lv, pm);
      o.connect(g);
      Q.vibD.connect(o.detune);
      Q.nodes.push(g);
      Q.srcs.push(this._live(o));
      return o;
    });
    const br = this._noise(this._buf.pink);
    Q.bp = this._f('bandpass', 1500, 1.6);
    Q.benv = this._g(0);
    br.connect(Q.bp);
    Q.bp.connect(Q.benv);
    Q.benv.connect(pp);
    Q.srcs.push(this._live(br));
    Q.nodes.push(pm, plp, pk, Q.penv, pp, Q.vibD, Q.bp, Q.benv);
    setp(this._scoreDuck.gain, 0, now, 0.8);
    this._cue = Q;
    return Q;
  }

  _cuePad(Q, notes, t, tc) {
    Q.pad.forEach((pair, i) => {
      const f = mtof(notes[i]);
      for (const o of pair) o.frequency.setTargetAtTime(f, t, tc);
    });
  }

  _cuePhrase(Q, notes, t0, vel) {
    let t = t0;
    const P = [[Q.penv.gain, 1], [Q.benv.gain, 0.28]];
    notes.forEach(([m, d], i) => {
      const f = mtof(m);
      const first = i === 0;
      const last = i === notes.length - 1;
      for (const o of Q.pipes) {
        if (first) o.frequency.setValueAtTime(f, t);
        else o.frequency.setTargetAtTime(f, t, 0.035);
      }
      Q.bp.frequency.setTargetAtTime(Math.min(f * 2.2, 6000), t, 0.03);
      for (const [p, s] of P) {
        const v = vel * s;
        if (first) {
          p.setValueAtTime(0, t);
          p.linearRampToValueAtTime(v, t + 0.14);
        } else {
          p.setValueAtTime(v, t);
          p.linearRampToValueAtTime(v * 0.7, t + 0.035);
          p.linearRampToValueAtTime(v, t + 0.1);
        }
        if (last) {
          p.setValueAtTime(v, t + d * 0.6);
          p.linearRampToValueAtTime(0, t + d + 0.3);
        }
      }
      Q.vibD.gain.setValueAtTime(0, t);
      Q.vibD.gain.linearRampToValueAtTime(d > 0.6 ? 13 : 6, t + Math.min(0.5, d));
      t += d;
    });
    this._lyre(t0, notes[0][0] + 12, 0.32, 0.25, { dest: Q.out, decay: 1.6 });
    return t + 0.3;
  }

  _cueResolve(Q, t) {
    if (Q.resolved) return;
    Q.resolved = true;
    Q.queue = [];
    const now = this._ctx.currentTime;
    const L = LV.sunrise;
    for (const p of [Q.penv.gain, Q.benv.gain, Q.vibD.gain, Q.bp.frequency, Q.lp.frequency, Q.out.gain]) hold(p, now);
    const f = mtof(SUN_FINAL);
    for (const o of Q.pipes) { hold(o.frequency, now); o.frequency.setTargetAtTime(f, t, 0.05); }
    Q.bp.frequency.setTargetAtTime(f * 2.2, t, 0.05);
    Q.penv.gain.setTargetAtTime(0.62, t, 0.08);
    Q.penv.gain.setTargetAtTime(0, t + 3, 1.2);
    Q.benv.gain.setTargetAtTime(0.12, t, 0.08);
    Q.benv.gain.setTargetAtTime(0, t + 3, 1);
    Q.vibD.gain.setTargetAtTime(15, t + 0.3, 0.4);
    this._cuePad(Q, SUN_RES, t, 0.3);
    Q.lp.frequency.setTargetAtTime(7000, t, 0.4);
    Q.lp.frequency.setTargetAtTime(2500, t + 4, 3);
    if (Q.plp) { hold(Q.plp.frequency, now); Q.plp.frequency.setTargetAtTime(7000, t, 0.3); Q.plp.frequency.setTargetAtTime(4000, t + 4, 2); }
    Q.out.gain.setTargetAtTime(1.25 * L, t, 0.25);
    Q.out.gain.setTargetAtTime(0, t + 6, 3.2);
    this._bell(t, mtof(74), 0.48 * L, { dest: Q.out, pan: -0.15, dur: 6, lp: 3500 });
    this._bell(t + 0.14, mtof(81), 0.34 * L, { dest: Q.out, pan: 0.25, dur: 5.5, lp: 3500 });
    this._bell(t + 0.34, mtof(86), 0.25 * L, { dest: Q.out, pan: 0.05, dur: 5, lp: 3500 });
    this._bell(t + 0.02, mtof(50), 0.28 * L, { dest: Q.out, dur: 8, soft: true });
    this._bloom(t, [38, 50, 57, 62, 66], 5, 0.07 * L, Q.out);
    this._air(t + 0.05, 2.5, 0.06 * L, Q.out);
    this._kymbal(t, 0.22 * L, Q.out);
    this._boom(t, 0.14 * L, Q.out);
    const R = this._rise;
    if (R && R.dawn) {
      this._risePad(R, SUN_RES_RISE, t, 0.3);
      for (const p of [R.out.gain, R.lp.frequency, R.shim.gain]) hold(p, now);
      R.out.gain.setTargetAtTime(0.42 * LV.rise, t, 0.25);
      R.out.gain.setTargetAtTime(0, t + 6, 3.2);
      R.shim.gain.setTargetAtTime(0.12, t, 0.3);
      R.shim.gain.setTargetAtTime(0, t + 5, 2.5);
      R.lp.frequency.setTargetAtTime(5000, t, 0.4);
      R.lp.frequency.setTargetAtTime(1800, t + 4, 3);
      this._rise = null;
      this._retire(R, t + 26);
    }
    const ad = this._ambDuck.gain;
    hold(ad, now);
    ad.setTargetAtTime(0.63, t, 0.3);
    ad.setTargetAtTime(1, t + 5, 2);
    Q.endAt = t + 26;
    Q.resolvedAt = t;
    if (this._endPend) { this._endPend = false; this._endAt = t + 9; }
    const sd = this._scoreDuck.gain;
    sd.cancelScheduledValues(now);
    sd.setTargetAtTime(0, now, 0.5);
    sd.setTargetAtTime(1, t + 6, 3);
    this._cueDone = true;
  }

  _cueFade(Q, now) {
    this._cue = null;
    hold(Q.out.gain, now);
    Q.out.gain.setTargetAtTime(0, now, 0.6);
    this._retire(Q, now + 5);
    setp(this._scoreDuck.gain, 1, now, 2);
  }


  _applyNight() {
    const K = this._night;
    if (Math.abs(K - this._nightSet) < 0.004) return;
    this._nightSet = K;
    this._airLevels();
  }


  async _boot() {
    try {
      let ctx = this._opts.context || null;
      if (!ctx) {
        const w = typeof window !== 'undefined' ? window : null;
        const AC = w && (w.AudioContext || w.webkitAudioContext);
        if (!AC) throw new Error('Web Audio unavailable');
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      }
      this._ctx = ctx;
      this._offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
      let resumed = null;
      if (!this._offline) {
        try { if (typeof ctx.resume === 'function') resumed = ctx.resume(); } catch (e) { resumed = null; }
        this._unlockBlip();
      }
      this._build();
      this._ready = true;
      this._applyMaster(0.05);
      if (this._mode) { const m = this._mode; this._mode = null; this.setMode(m); }
      if (this._stageReq) { const s = this._stageReq; this._stageReq = null; this.setMusic(s); }
      this._applyNight();
      if (this._offline) return;
      this._timer = setInterval(() => this._tick(), TICK_MS);
      this._bakeAll();
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVis);
      if (resumed && typeof resumed.then === 'function') {
        await Promise.race([resumed.catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
      }
      if (ctx.state !== 'running') this._armUnlock();
    } catch (e) {
      this._note(e);
      this._fail();
    }
  }

  _fail() {
    this._failed = true;
    this._ready = false;
    try { clearInterval(this._timer); } catch (e) {  }
    try { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVis); } catch (e) {  }
    try { if (this._ctx && !this._offline && typeof this._ctx.close === 'function') quiet(this._ctx.close()); } catch (e) {  }
  }

  _resume() {
    try {
      const ctx = this._ctx;
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (ctx && !this._offline && ctx.state !== 'running' && ctx.state !== 'closed' && !hidden) quiet(ctx.resume());
    } catch (e) {  }
  }

  _unlockBlip() {
    try {
      const ctx = this._ctx;
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start(0);
      s.onended = () => drop(s);
    } catch (e) {  }
  }

  _onVis() {
    try {
      const ctx = this._ctx;
      if (!ctx || !this._ready) return;
      if (document.hidden) {
        if (ctx.state === 'running') { this._visSuspended = true; quiet(ctx.suspend()); }
      } else if (this._visSuspended || ctx.state !== 'running') {
        this._visSuspended = false;
        quiet(ctx.resume());
      }
    } catch (e) {  }
  }

  _armUnlock() {
    if (this._unlockArmed || typeof document === 'undefined') return;
    this._unlockArmed = true;
    const evs = ['pointerdown', 'touchend', 'mousedown', 'keydown'];
    const h = () => {
      const ctx = this._ctx;
      if (!ctx || ctx.state === 'running' || ctx.state === 'closed') {
        evs.forEach((e) => document.removeEventListener(e, h, true));
        this._unlockArmed = false;
        return;
      }
      if (!document.hidden) { try { quiet(ctx.resume()); } catch (e) {  } }
    };
    evs.forEach((e) => document.addEventListener(e, h, true));
  }

  _armAutoStart() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const evs = ['pointerdown', 'keydown', 'touchend', 'mousedown'];
    const off = () => evs.forEach((e) => window.removeEventListener(e, h, true));
    const h = () => {
      off();
      this._autoOff = null;
      if (!this._ready && !this._failed) quiet(this.start());
    };
    evs.forEach((e) => window.addEventListener(e, h, true));
    this._autoOff = off;
  }

  _run(fn) {
    if (!this._ready || !this._ctx) return undefined;
    try { return fn(); } catch (e) { this._note(e); return undefined; }
  }

  _note(e) {
    this._errors++;
    this._lastError = String((e && e.message) || e).slice(0, 200);
  }

  _applyMaster(tc = 0.04) {
    this._run(() => setp(this._master.gain, this._muted ? 0 : this._volume * MIX.master, this._ctx.currentTime, tc));
  }


  _build() {
    const ctx = this._ctx;
    const D = this._data || genAll(SR_GEN, true);
    this._data = null;
    for (const k of Object.keys(GEN_LATE)) if (!D[k]) D[k] = GEN_LATE[k](SR_GEN);
    const mk = (chans, sr) => {
      const b = ctx.createBuffer(chans.length, chans[0].length, sr);
      chans.forEach((c, i) => b.getChannelData(i).set(c));
      return b;
    };
    this._buf = {};
    for (const k of Object.keys(D)) this._buf[k] = mk(D[k], SR_GEN);
    const lw = 24;
    const li = new Float32Array(lw + 1);
    for (let k = 1; k <= lw; k++) li[k] = Math.abs(Math.sin(k * Math.PI * 0.19)) / Math.pow(k, 1.35);
    this._lyreWave = ctx.createPeriodicWave(new Float32Array(lw + 1), li);
    this._swellWave = ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, 0.42, 0.2, 0.09]));
    const sn = 12;
    const sre = new Float32Array(sn + 1);
    for (let k = 1; k <= sn; k++) sre[k] = -4 / Math.PI / (4 * k * k - 1);
    this._strokeWave = ctx.createPeriodicWave(sre, new Float32Array(sn + 1));

    this._mix = this._g(1);
    const hp = this._f('highpass', 28, 0.7);
    this._mix.connect(hp);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.knee.value = 8;
    glue.ratio.value = 2;
    glue.attack.value = 0.02;
    glue.release.value = 0.25;
    hp.connect(glue);
    this._master = this._g(0);
    glue.connect(this._master);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.1;
    this._master.connect(lim);
    const clip = ctx.createWaveShaper();
    clip.curve = makeSoftClip();
    clip.oversample = '4x';
    lim.connect(clip);
    clip.connect(ctx.destination);
    this._glue = glue;
    this._lim = lim;

    this._reverb = ctx.createConvolver();
    this._reverb.buffer = mk(genImpulse(ctx.sampleRate, 2.6), ctx.sampleRate);
    this._revLP = this._f('lowpass', 7000, 0.5);
    this._reverb.connect(this._revLP);
    this._revLP.connect(this._g(MIX.reverb, this._mix));

    this._world = this._g(1);
    this._world.channelCount = 2;
    this._world.channelCountMode = 'explicit';
    this._world.channelInterpretation = 'speakers';
    const wsp = ctx.createChannelSplitter(2);
    const wmg = ctx.createChannelMerger(2);
    this._world.connect(wsp);
    this._wA = [this._g(1), this._g(1)];
    this._wB = [this._g(0), this._g(0)];
    for (let c = 0; c < 2; c++) {
      wsp.connect(this._wA[c], c);
      wsp.connect(this._wB[c], c);
      this._wA[c].connect(wmg, 0, c);
      this._wB[c].connect(wmg, 0, 1 - c);
    }
    wmg.connect(this._mix);

    this._ambBus = this._g(MIX.amb, this._world);
    this._ambDuck = this._g(1, this._ambBus);
    this._airBus = this._g(0, this._ambDuck);
    this._waterBus = this._g(0, this._ambDuck);
    this._ambSend = this._g(0.04, this._reverb);
    this._ambDuck.connect(this._ambSend);

    this._sfxBus = this._g(1);
    this._sfxPeak = this._f('peaking', 450, 1);
    this._sfxPeak.gain.value = 0;
    this._sfxShelf = this._f('highshelf', 1200);
    this._sfxShelf.gain.value = 0;
    this._sfxLP = this._f('lowpass', 18000, 0.6);
    this._sfxBus.connect(this._sfxPeak);
    this._sfxPeak.connect(this._sfxShelf);
    this._sfxShelf.connect(this._sfxLP);
    const sfxOut = this._g(MIX.sfx, this._world);
    this._sfxOut = sfxOut;
    this._sfxLP.connect(sfxOut);
    this._sfxSend = this._g(0.05, this._reverb);
    sfxOut.connect(this._sfxSend);
    this._plungeG = this._g(0.1, this._sfxBus);
    this._plungeLP = this._f('lowpass', 400, 0.7, this._plungeG);
    this._plungeBus = this._g(1, this._plungeLP);
    this._roomIn = this._g(0);
    this._roomDl = ctx.createDelay(0.1);
    this._roomDl.delayTime.value = 0.017;
    const rlp = this._f('lowpass', 1200, 0.5);
    const rfb = this._g(-0.4);
    this._roomIn.connect(this._roomDl);
    this._roomDl.connect(rlp);
    rlp.connect(rfb);
    rfb.connect(this._roomDl);
    rlp.connect(this._g(-0.5, this._world));
    sfxOut.connect(this._g(0.25, this._roomIn));
    this._ambDuck.connect(this._g(0.15, this._roomIn));
    this._breathBus = this._g(0);
    this._helmetPH = this._g(1);
    this._helmetDuck = this._g(1);
    this._breathBus.connect(this._helmetPH);
    this._helmetPH.connect(this._helmetDuck);
    const hHP = this._f('highpass', 160, 0.7);
    const hShelf = this._f('lowshelf', 200);
    hShelf.gain.value = -6;
    const dome = this._f('peaking', 480, 3.5);
    dome.gain.value = 3;
    this._helmetDuck.connect(hHP);
    hHP.connect(hShelf);
    hShelf.connect(dome);
    const hOut = this._g(1, this._world);
    this._helmetOut = hOut;
    dome.connect(hOut);
    [[0.00045, 0.35], [0.0008, 0.25], [0.0013, 0.18]].forEach(([d, g]) => {
      const dl = ctx.createDelay(0.01);
      dl.delayTime.value = d;
      dome.connect(dl);
      dl.connect(this._g(g, hOut));
    });
    this._heartG = this._g(1, hOut);
    this._heartIn = this._f('highpass', 45, 0.7, this._heartG);
    this._suitBus = this._g(1);
    this._suitBus.connect(this._f('lowpass', 3500, 0.7, this._g(0.5, this._breathBus)));
    this._rockTaps = this._taps(this._sfxBus, [-0.15, 0.15]);

    this._stingBus = this._g(MIX.sting, this._mix);
    this._stingBus.connect(this._g(0.3, this._reverb));

    this._musicBus = this._g(1);
    this._musicLP = this._f('lowpass', 18000, 0.5);
    this._musicBus.connect(this._musicLP);
    const musicOut = this._g(MIX.music, this._mix);
    this._musicDip = this._g(1, musicOut);
    this._musicLP.connect(this._musicDip);
    musicOut.connect(this._g(0.35, this._reverb));

    this._uiBus = this._g(MIX.ui, this._mix);
    this._uiBus.connect(this._g(0.12, this._reverb));

    this._thudWave = ctx.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, 0.5, 0.32]));
    this._heartWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 0.25, 0.5, 1, 0.6, 0.22]));
    this._pulseWave = ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, 0.71, 0.35, 0.2]));
    this._beaconWave = ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0, 0.5, 1, 0.75, 0.3]));
    const mr = new Float32Array(25);
    for (let k = 1; k <= 24; k++) mr[k] = Math.pow(10, (-1.5 * (k - 1)) / 20);
    this._meshWave = ctx.createPeriodicWave(mr, new Float32Array(25));
    this._buildScore();
    this._scheds = [this._schedMusic, this._schedCrank, this._schedAmbience, this._schedSwell, this._schedCue, this._schedIdle, this._schedPod,
      this._schedRise, this._schedRock, this._schedHeart];
  }

  _buildScore() {
    const ctx = this._ctx;
    this._scoreDuck = this._g(1, this._musicBus);
    this._scoreGain = this._g(0, this._scoreDuck);
    const sg = this._scoreGain;
    const lyre = this._g(1, sg);
    this._lyreTaps = this._taps(lyre, LYRE_PANS);
    [[0.013, 0.23, -0.7], [0.019, 0.31, 0.7]].forEach(([base, rate, pan]) => {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = base;
      this._mod(this._live(this._osc('sine', rate)), 0.0025, d.delayTime);
      const p = this._pan(pan, this._g(0.32, sg));
      lyre.connect(d);
      d.connect(p);
    });
    const echoIn = this._g(0.2);
    lyre.connect(echoIn);
    this._echoA = ctx.createDelay(2);
    this._echoB = ctx.createDelay(2);
    this._echoA.delayTime.value = 0.75;
    this._echoB.delayTime.value = 0.75;
    const elp = this._f('lowpass', 2600, 0.3);
    const pl = this._pan(-0.6, sg);
    const pr = this._pan(0.6, sg);
    const fb = this._g(0.32, this._echoA);
    echoIn.connect(this._echoA);
    this._echoA.connect(elp);
    elp.connect(pl);
    elp.connect(this._echoB);
    this._echoB.connect(pr);
    this._echoB.connect(fb);
    this._pulseGain = this._g(0, sg);
    this._shimmerGain = this._g(1, sg);
    this._padGain = this._g(0, sg);
    this._padLP = this._f('lowpass', 1000, 1.2, this._padGain);
    this._mod(this._live(this._osc('sine', 0.067)), 140, this._padLP.frequency);
    const chorus = this._live(this._osc('sine', 0.18));
    const cUp = this._g(5);
    const cDn = this._g(-5);
    chorus.connect(cUp);
    chorus.connect(cDn);
    this._padVoices = CHORDS.Dm.pad.map((m, i) => {
      const vg = this._g(1, this._pan([-0.1, -0.45, 0.45, 0.15][i], this._padLP));
      return [['sawtooth', -7, cUp, 0.045], ['triangle', 5, cDn, 0.05]].map(([type, det, mod, lv]) => {
        const o = this._osc(type, mtof(m));
        o.detune.value = det;
        mod.connect(o.detune);
        o.connect(this._g(lv, vg));
        return this._live(o);
      });
    });
    this._droneGain = this._g(0, sg);
    const dlp = this._f('lowpass', 420, 0.7, this._droneGain);
    this._mod(this._live(this._osc('sine', 0.043)), 90, dlp.frequency);
    this._isonV = [[38, 'sawtooth', 0.06], [45, 'sawtooth', 0.035], [50, 'triangle', 0.05], [57, 'triangle', 0.04]].map(([m, type, lv], k) => {
      const o = this._osc(type, mtof(m));
      const g = this._g(k < 3 ? lv : 0, dlp);
      o.connect(g);
      this._live(o);
      return [g, lv];
    });
  }

  _ensureAirBed(variant) {
    let A = this._airBed;
    if (A) { A.variant = variant; A.offAt = 0; this._airLevels(); return A; }
    A = { variant, offAt: 0, nextLap: 0, nextGull: 0, nextCreak: 0, nextBell: 0, srcs: [], nodes: [] };
    A.out = this._g(LV.air * (variant === 'sea' ? 1 : 0.5), this._airBus);
    A.events = this._g(1, A.out);
    const wash = this._live(this._noise(this._buf.brown, 0.62));
    const wg = this._g(0.075);
    const wlp = this._f('lowpass', 520, 0.4, wg);
    wash.connect(wlp);
    A.washN = this._g(1, A.out);
    wg.connect(A.washN);
    const hiss = this._live(this._noise(this._buf.pink, 0.93));
    const hg = this._g(0.035);
    const hbp = this._f('bandpass', 950, 0.55, hg);
    hiss.connect(hbp);
    A.hissN = this._g(1, A.out);
    hg.connect(A.hissN);
    const sw = this._osc('sine', 0.085);
    sw.setPeriodicWave(this._swellWave);
    this._live(sw);
    const m1 = this._mod(sw, 0.034, wg.gain);
    const m2 = this._mod(sw, 0.015, hg.gain);
    const m3 = this._mod(sw, 180, wlp.frequency);
    const wind = this._live(this._noise(this._buf.pink, 0.81));
    const windG = this._g(0.055);
    const wbp = this._f('bandpass', 480, 0.9, windG);
    const whG = this._g(0);
    const wh = this._f('bandpass', 150, 30, whG);
    wind.connect(wbp);
    wind.connect(wh);
    A.windN = this._g(1, A.out);
    windG.connect(A.windN);
    whG.connect(A.windN);
    const gust = this._live(this._osc('sine', 0.051));
    const gust2 = this._live(this._osc('sine', 0.023));
    const m4 = this._mod(gust, 150, wbp.frequency);
    const m5 = this._mod(gust, 0.03, windG.gain);
    const m6 = this._mod(gust, 50, wh.frequency);
    const gsh = this._ctx.createWaveShaper();
    const cv = new Float32Array(257);
    for (let i = 0; i < 257; i++) cv[i] = Math.pow(Math.max(0, (i / 256) * 2 - 1 - 0.2) / 0.8, 2);
    gsh.curve = cv;
    gust.connect(gsh);
    const m6b = this._g(1.2 * LV.rig, whG.gain);
    gsh.connect(m6b);
    const m7 = this._mod(gust2, 0.02, windG.gain);
    const wz = this._live(this._noise(this._buf.pink, 1.13));
    const wzG = this._g(0.04);
    const whp = this._f('highpass', 2000, 0.7);
    const wlp2 = this._f('lowpass', 8000, 0.7, wzG);
    wz.connect(whp);
    whp.connect(wlp2);
    A.wzN = this._g(1, A.out);
    wzG.connect(A.wzN);
    const m9 = this._mod(gust, 0.024, wzG.gain);
    const m10 = this._mod(gust2, 0.01, wzG.gain);
    const fz = this._live(this._noise(this._buf.pink, 1.07));
    const fzG = this._g(0.1 * LV.fizz);
    const fhp = this._f('highpass', 1800, 0.7);
    const flp = this._f('lowpass', 9000, 0.7, fzG);
    fz.connect(fhp);
    fhp.connect(flp);
    fzG.connect(A.hissN);
    const m8 = this._mod(sw, 0.09 * LV.fizz, fzG.gain);
    A.sw = sw;
    A.srcs = [wash, hiss, sw, wind, gust, gust2, fz, wz];
    A.nodes = [A.events, wg, wlp, A.washN, hg, hbp, A.hissN, m1, m2, m3, windG, wbp, whG, wh, A.windN, m4, m5, m6, gsh, m6b, m7,
      fzG, fhp, flp, m8, wzG, whp, wlp2, m9, m10, A.wzN];
    this._airBed = A;
    this._airLevels();
    return A;
  }

  _airOpen(t) {
    const A = this._airBed;
    if (!A || this._baking) return;
    const p = A.out.gain;
    hold(p, t);
    p.setValueAtTime(2.4 * this._airBase(A), t);
    p.setTargetAtTime(this._airBase(A), t + 0.9, 1.6);
    for (const N of [A.windN, A.wzN]) {
      const w = N.gain;
      hold(w, t);
      w.setValueAtTime(1.8 * w.value, t);
    }
    A.openUntil = t + 0.9;
    this._airLevels(A.openUntil, 1.4);
  }

  _airBase(A) { return LV.air * (A.variant === 'sea' ? 1 : 0.5); }

  _airLevels(at, tc = 0.6) {
    const A = this._airBed;
    if (!A) return;
    const n = this._night;
    const sea = A.variant === 'sea';
    const t = Math.max(this._ctx.currentTime, at || 0, A.openUntil || 0);
    setp(A.out.gain, this._airBase(A), t, tc);
    setp(A.washN.gain, (sea ? 1.1 : 1) * (1 - 0.35 * n), t, tc);
    setp(A.windN.gain, (sea ? 0.85 : 1) * (1 - 0.45 * n), t, tc);
    setp(A.wzN.gain, (sea ? 0.85 : 1.5) * (1 - 0.45 * n), t, tc);
    setp(A.hissN.gain, (sea ? 1.15 : 1) * (1 - 0.25 * n), t, tc);
  }

  _ensureWaterBed() {
    let W = this._waterBed;
    if (W) { W.offAt = 0; return W; }
    W = { offAt: 0, nextSnap: 0, nextFish: 0, nextCreak: 0, nextWhale: 0, srcs: [], nodes: [] };
    W.out = this._g(LV.water, this._waterBus);
    W.events = this._g(1);
    const fsh = this._f('highshelf', 4000);
    fsh.gain.value = -8;
    const flp = this._f('lowpass', 9000, 0.6, W.out);
    W.events.connect(fsh);
    fsh.connect(flp);
    const brown = this._live(this._noise(this._buf.brown, 0.58));
    const rumble = this._g(0.14, W.out);
    const rlp = this._f('lowpass', 105, 0.7, rumble);
    const body = this._g(0.06, W.out);
    const bbp = this._f('bandpass', 230, 0.8, body);
    brown.connect(rlp);
    brown.connect(bbp);
    const surge = this._live(this._noise(this._buf.brown, 1.17));
    const sg = this._g(0.12, W.out);
    const slp = this._f('lowpass', 360, 1.1, sg);
    surge.connect(slp);
    const sw = this._osc('sine', 1 / 8.3);
    sw.setPeriodicWave(this._swellWave);
    this._live(sw);
    const m1 = this._mod(sw, 0.13, sg.gain);
    const m2 = this._mod(sw, 170, slp.frequency);
    const drift = this._live(this._osc('sine', 0.041));
    const m3 = this._mod(drift, 0.08, rumble.gain);
    const hiss = this._live(this._noise(this._buf.pink, 0.77));
    const hg = this._g(0.018, W.out);
    const hbp = this._f('bandpass', 1200, 0.6, hg);
    hiss.connect(hbp);
    const snapHP = this._f('highpass', 2200, 0.7);
    const snapLP = this._f('lowpass', 9000, 0.5, W.events);
    snapHP.connect(snapLP);
    W.snapTaps = this._taps(snapHP, SNAP_PANS, SNAP_GAINS.map((g) => g * 0.05 * LV.snap));
    W.srcs = [brown, surge, sw, drift, hiss];
    W.nodes = [W.events, fsh, flp, rumble, rlp, body, bbp, sg, slp, m1, m2, m3, hg, hbp, snapHP, snapLP, ...W.snapTaps];
    this._waterBed = W;
    return W;
  }

  _retire(L, stopAt) {
    if (!L || L.dead) return;
    L.dead = true;
    const nodes = [L.out, ...(L.nodes || [])];
    let left = L.srcs.length;
    if (!left) { drop(...nodes); return; }
    const fin = () => { if (--left <= 0) drop(...nodes); };
    for (const s of L.srcs) {
      s._after = fin;
      try { s.stop(stopAt); } catch (e) { fin(); }
    }
  }


  async _bakeAll() {
    const w = typeof window !== 'undefined' ? window : null;
    const OAC = w && (w.OfflineAudioContext || w.webkitOfflineAudioContext);
    if (!OAC || this._bakeOn || this._offline) return;
    this._bakeOn = true;
    let first = true;
    for (const [name, secs, takes, rate, bus, once, run] of BAKES) {
      for (let k = 0; k < takes; k++) {
        if (!first) await idle();
        first = false;
        if (this._failed || !this._ready) return;
        try {
          const T = await this._bakeOne(OAC, secs, rate, run);
          if (!T) continue;
          T.bus = bus;
          const B = this._baked[name] || (this._baked[name] = { takes: [], last: -1, once });
          B.takes.push(T);
        } catch (e) { this._note(e); }
      }
    }
  }

  async _bakeOne(OAC, secs, rate, run) {
    const sr = rate || this._ctx.sampleRate;
    const oc = new OAC(3, Math.ceil(secs * sr), sr);
    const e = this._shadow(oc);
    const info = run(e);
    if (e._errors) { this._errors += e._errors; this._lastError = e._lastError; }
    const got = new Promise((res) => { oc.oncomplete = (ev) => res(ev.renderedBuffer); });
    const p = oc.startRendering();
    const buf = await (p && typeof p.then === 'function' ? p : got);
    return this._stems(buf, info, e);
  }

  _shadow(oc) {
    const e = Object.create(Object.getPrototypeOf(this));
    Object.assign(e, {
      _opts: {}, _ctx: oc, _offline: true, _baking: true, _ready: true, _failed: false,
      _buf: this._buf, _lyreWave: this._lyreWave, _swellWave: this._swellWave, _strokeWave: this._strokeWave, _ladders: this._ladders,
      _thudWave: this._thudWave, _pulseWave: this._pulseWave, _meshWave: this._meshWave, _beaconWave: this._beaconWave,
      _voices: 0, _oscs: 0, _persist: 0, _lyreVoices: 0, _errors: 0, _lastError: '',
      _lastTick: -1, _lastCrack: -1, _lastClack: -1, _lastHover: -1, _lastGlyph: -1, _tickPan: 0.15,
      _breathBusy: 0, _exhaleT: 0, _modeOn: 'underwater', _lis: { dH: 1, depth: 13, close: 1, dW: 10 },
      _swell: null, _cue: null, _crankL: null, _brushL: null, _baked: null, _rise: null, _eclL: null,
      _heroSeated: [], _heroN: 0, _revealed: 0, _revealedIdx: [], _rockQ: [],
    });
    e._duckMusic = () => {};
    e._duck = () => {};
    const dry = oc.createGain();
    dry.channelCount = 2;
    dry.channelCountMode = 'explicit';
    dry.channelInterpretation = 'speakers';
    const wet = oc.createGain();
    const split = oc.createChannelSplitter(2);
    const merge = oc.createChannelMerger(3);
    dry.connect(split);
    split.connect(merge, 0, 0);
    split.connect(merge, 1, 1);
    wet.connect(merge, 0, 2);
    merge.connect(oc.destination);
    e._sfxBus = e._stingBus = e._breathBus = e._uiBus = e._musicBus = e._plungeBus = e._suitBus = dry;
    e._rockTaps = [dry, dry];
    e._reverb = wet;
    return e;
  }

  _stems(buf, info, e) {
    const sr = buf.sampleRate;
    const L = buf.getChannelData(0), R = buf.getChannelData(1), W = buf.getChannelData(2);
    const nd = Math.max(audibleEnd(L), audibleEnd(R)), nw = audibleEnd(W);
    if (!nd && !nw) return null;
    const T = { dry: null, wet: null, bus: 'sfx', exhaleAt: info && info.exhaleAt > 0 ? info.exhaleAt : 0, busy: e._breathBusy };
    if (nd) {
      T.dry = this._ctx.createBuffer(2, nd, sr);
      T.dry.getChannelData(0).set(L.subarray(0, nd));
      T.dry.getChannelData(1).set(R.subarray(0, nd));
      this._bakeBytes += nd * 8;
    }
    if (nw) {
      T.wet = this._ctx.createBuffer(1, nw, sr);
      T.wet.getChannelData(0).set(W.subarray(0, nw));
      this._bakeBytes += nw * 4;
    }
    return T;
  }

  _take(name) {
    const B = this._baked && this._baked[name];
    if (!B || this._baking) return null;
    const n = B.takes.length;
    if (!n) return null;
    let k = (Math.random() * n) | 0;
    if (n > 1 && k === B.last) k = (k + 1) % n;
    B.last = k;
    if (B.once) this._baked[name] = null;
    return B.takes[k];
  }

  _play(T, gain = 1, rate = 1, wetGain = gain, dest = null, at = 0) {
    if (!T || !this._room(2)) return false;
    const t = Math.max(this._ctx.currentTime, at || 0);
    const bus = dest || (T.bus === 'sting' ? this._stingBus : T.bus === 'breath' ? this._breathBus : T.bus === 'music' ? this._musicBus : this._sfxBus);
    if (T.dry) this._stem(T.dry, bus, t, gain, rate);
    if (T.wet) this._stem(T.wet, this._reverb, t, wetGain, rate);
    return true;
  }

  _stem(buf, dest, t, gain, rate) {
    const s = this._src(buf);
    if (rate !== 1) s.playbackRate.value = rate;
    const g = this._g(gain, dest);
    s.connect(g);
    this._fire(s, t, t + buf.duration / rate + 0.02, [g], 0);
  }

  _baked1(name, gain = 1, rate = 1, wetGain = gain) {
    return !!this._run(() => this._play(this._take(name), gain, rate, wetGain));
  }


  _schedPod(now, h) {
    const P = this._pod;
    if (!P) return;
    if (now > P.t0 + P.dur) { this._pod = null; return; }
    const W = this._waterBed;
    if (!W || this._modeOn !== 'underwater') return;
    if (P.next < now - 0.2) P.next = now + rand(0.1, 0.5);
    if (P.nextClick < now - 0.2) P.nextClick = now + rand(0.2, 0.8);
    if (P.next < h) {
      const u = clamp$1((P.next - P.t0) / P.dur, 0, 1);
      this._whistle(Math.max(P.next, now + 0.005), P.side * (0.6 - 1.2 * u), 1 - 1.1 * Math.abs(u - 0.45), W);
      P.next += rand(2, 4.5);
    }
    if (P.nextClick < h) {
      const u = clamp$1((P.nextClick - P.t0) / P.dur, 0, 1);
      this._clickTrain(Math.max(P.nextClick, now + 0.005), P.side * (0.6 - 1.2 * u), 1 - 1.1 * Math.abs(u - 0.45), W);
      P.nextClick += rand(4, 7);
    }
  }

  _whistle(t, pan, prox, W) {
    if (!this._oscRoom(3) || !this._room(3, true)) return;
    const dur = rand(0.35, 1.0);
    const lo = rand(3400, 5000), hi = lo * rand(1.15, 1.4);
    const shape = Math.random();
    const a = shape < 0.45 || shape >= 0.8 ? lo : hi;
    const b = shape < 0.8 && shape >= 0.45 ? lo : hi;
    const o = this._osc('sine', a);
    const o2 = this._osc('sine', a * 2);
    const glide = (p, m) => {
      p.setValueAtTime(a * m, t);
      if (shape >= 0.8) {
        p.exponentialRampToValueAtTime(b * m, t + dur * 0.55);
        p.exponentialRampToValueAtTime(a * 1.08 * m, t + dur);
      } else p.exponentialRampToValueAtTime(b * m, t + dur);
    };
    glide(o.frequency, 1);
    glide(o2.frequency, 2);
    const vib = this._osc('sine', rand(9, 15));
    const vd = this._g(rand(15, 40));
    vib.connect(vd);
    vd.connect(o.detune);
    vd.connect(o2.detune);
    const pn = this._pan(clamp$1(pan, -1, 1), W.events);
    const send = this._g(0.8, this._reverb);
    pn.connect(send);
    const far = this._f('lowpass', 5200, 0.5, pn);
    const env = this._g(0, far);
    const lvl = 0.028 * LV.dolphin * clamp$1(prox, 0.25, 1);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + 0.04);
    env.gain.setValueAtTime(lvl * 0.85, t + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const g2 = this._g(0.05, env);
    o.connect(env);
    o2.connect(g2);
    const G = this._grp(vd, g2, env, far, pn, send);
    this._fire(o, t, t + dur + 0.02, null, undefined, G);
    this._fire(o2, t, t + dur + 0.02, null, undefined, G);
    this._fire(vib, t, t + dur + 0.02, null, undefined, G);
    this._seal(G);
  }

  _clickTrain(t, pan, prox, W) {
    if (!this._room(1, true)) return;
    const dur = rand(0.3, 0.8);
    const s = this._src(this._buf.clickPad, true);
    const r0 = rand(0.8, 1.5);
    s.playbackRate.setValueAtTime(r0, t);
    s.playbackRate.exponentialRampToValueAtTime(r0 * rand(2.5, 5), t + dur);
    const pn = this._pan(clamp$1(pan, -1, 1), W.events);
    const env = this._g(0, pn);
    const lvl = 0.045 * LV.dolphin * clamp$1(prox, 0.25, 1);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + 0.05);
    env.gain.setValueAtTime(lvl, t + dur * 0.75);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const hp = this._f('highpass', 2500, 0.7, env);
    s.connect(hp);
    this._fire(s, t, t + dur + 0.02, [hp, env, pn], 0);
  }


  _tick() {
    const ctx = this._ctx;
    if (!this._ready || !ctx || ctx.state !== 'running') return;
    this._pump(ctx.currentTime);
  }

  _pump(now) {
    const h = now + LOOKAHEAD;
    for (const f of this._scheds) {
      try { f.call(this, now, h); } catch (e) { this._note(e); }
    }
  }

  _schedMusic(now, h) {
    if (this._endAt > 0 && now >= this._endAt - LOOKAHEAD) {
      this._endAt = 0;
      if (this._stage === 'off') { this._nextStep = now + 0.06; this._step = 0; }
      if (this._stage !== 'end') this._pending = 'end';
    }
    if (this._stage === 'off' && !this._pending) return;
    if (this._nextStep < now - 0.25) this._nextStep = now + 0.05;
    for (let guard = 0; guard < 16 && this._nextStep < h; guard++) {
      const t = this._nextStep;
      if (this._pending && (this._stage === 'off' || this._step % 4 === 0)) this._applyStage(this._pending, t);
      if (this._stage === 'off') return;
      try { this._playStep(t); } catch (e) { this._note(e); }
      this._nextStep = t + 60 / STAGES[this._stage].bpm / 4;
      if (++this._step >= 16) { this._step = 0; this._bar++; }
    }
  }

  _applyStage(name, t) {
    this._pending = null;
    const st = STAGES[name];
    if (!st) return;
    const from = this._stage;
    this._stage = name;
    this._step = 0;
    this._bar = 0;
    this._stageT0 = t;
    this._phrase = null;
    this._arp = null;
    this._lastChord = '';
    this._sparseEcho = null;
    setp(this._scoreGain.gain, st.vol || 1, t, 0.5);
    if (st.fadeIn && from === 'off') {
      setp(this._droneGain.gain, st.drone * 0.7, t, 4);
      const pg = this._padGain.gain;
      pg.cancelScheduledValues(t);
      pg.setTargetAtTime(0, t, 0.3);
      pg.setTargetAtTime(st.pad, t + 2, 2);
      this._lastLyre = t - (st.gap || 0) + 6;
    } else {
      setp(this._padGain.gain, st.pad, t, 1.2);
      setp(this._droneGain.gain, st.drone * 0.7, t, 1.6);
    }
    setp(this._pulseGain.gain, st.pulse * 0.9, t, 0.3);
    if (this._isonV) this._isonV.forEach(([g, lv], k) => setp(g.gain, lv * (st.ison ? st.ison[k] : k < 3 ? 1 : 0), t, 1.6));
    setp(this._echoA.delayTime, 45 / st.bpm, t, 0.4);
    setp(this._echoB.delayTime, 45 / st.bpm, t, 0.4);
    setp(this._padLP.frequency, st.cut, t, 0.9);
    if (name === 'end') this._lastPhrase = -1e9;
  }

  _playStep(t) {
    const st = STAGES[this._stage];
    const step = this._step;
    const bar = this._bar;
    const name = st.prog[bar % st.prog.length];
    const ch = CHORDS[name];
    const k = 0;
    if (step === 0) {
      if (name !== this._lastChord && this._stage !== 'crank') { this._padChord(t, ch.pad); this._lastChord = name; }
      if (st.bass) this._lyre(t, ch.bass, st.bass, -0.15, { decay: 2.2 });
      if (st.lyre === 'phrase') {
        this._phrase = st.intro && bar === 0 ? END_INTRO : Math.random() < st.phraseProb ? pick(PHRASES) : null;
        if (this._phrase && st.intro && bar > 0 && t - (this._lastPhrase || -1e9) < (t - this._stageT0 > 90 ? 30 : 12)) this._phrase = null;
        if (this._phrase) this._lastPhrase = t;
      } else if (st.lyre === 'arp8r') this._arp = ARP8R[bar % ARP8R.length];
    }
    const lad = this._ladder(ch.pcs, st.lo);
    const play = (i, v) => {
      if (i < 0) return;
      let m = lad[Math.min(i, lad.length - 1)];
      if (st.passing && Math.random() < st.passing) m = scaleStep(m, st.scale, Math.random() < 0.5 ? 1 : -1);
      this._lyre(t + rand(0, 0.01), m, v, clamp$1((m - 72) / 22, -0.6, 0.6) + rand(-0.1, 0.1), { decay: st.decay });
    };
    switch (st.lyre) {
      case 'phrase':
        if (this._phrase) for (const [s, i, v] of this._phrase) if (s === step) play(i, v);
        break;
      case 'sparse':
        if (t < this._lyreQuiet) { this._sparseEcho = null; break; }
        if (step % 4 === 0 && t - this._lastLyre >= (st.gap || 0) && Math.random() < st.noteProb) {
          const i = 1 + ((Math.random() * 4) | 0);
          play(i, rand(0.28, 0.42));
          this._lastLyre = t;
          if (Math.random() < 0.3) this._sparseEcho = { step: step + 2 + 2 * ((Math.random() * 2) | 0), i: Math.max(0, i + pick([-1, 1, 2])) };
        } else if (this._sparseEcho && this._sparseEcho.step === step) {
          play(this._sparseEcho.i, 0.26);
          this._sparseEcho = null;
        }
        break;
      case 'arp8r':
        if (this._asmLyre && step % 2 === 0 && this._arp && Math.random() < (st.arpKeep || 1)) play(this._arp[step >> 1], step % 8 === 0 ? 0.42 : 0.3);
        break;
      case 'crank8':
        if (step % 2 === 0) play((CRANK8A )[step >> 1], (step % 4 === 0 ? 0.42 : 0.3) * (0.85 + 0.3 * k));
        break;
      case 'rare':
        if (step === 0 && bar % 2 === 1) play(1 + ((Math.random() * 3) | 0), 0.28);
        break;
    }
    if (st.drumSeq) {
      if (step === 0) this._drum(t, 1, k);
      else if (step === 8) this._drum(t, 0.8, k);
      else ;
    }
    if (st.shimmer && step % 4 === 2 && Math.random() < st.shimmer) this._shimmer(t + 0.01, ch);
  }

  _ladder(pcs, lo) {
    const key = pcs.join(',') + '@' + lo;
    let l = this._ladders.get(key);
    if (!l) {
      l = [];
      for (let m = lo; l.length < 9 && m < 112; m++) if (pcs.includes(pc(m))) l.push(m);
      this._ladders.set(key, l);
    }
    return l;
  }

  _padChord(t, notes) {
    this._padVoices.forEach((oscs, i) => {
      const f = mtof(notes[i]);
      for (const o of oscs) o.frequency.setTargetAtTime(f, t, 0.12);
    });
  }

  _schedCrank(now, h) {
    const C = this._crankL;
    if (!C) return;
    if (C.idleAt && now - C.idleAt > 3) { this._retire(C, now + 0.3); this._crankL = null; return; }
    if (C.hasAngle) {
      const P = C.P;
      if (this._stage === 'crank' && !C.done && Math.abs(P - C.pSet) > 0.01) {
        C.pSet = P;
        setp(this._padGain.gain, P < 0.15 ? 0 : 0.3 + 0.25 * P, now, 1);
        setp(this._padLP.frequency, 900 + 2300 * P, now, 0.8);
      }
      const r1 = 18.1 * Math.abs(C.v);
      for (const [r, w, key] of [[r1, 0, 'n1'], [0.57 * r1, 1, 'n2']]) {
        if (r < 0.5 || r > 30 || this._crank < 0.02) { C[key] = 0; continue; }
        if (!C[key] || C[key] < now - 0.2) C[key] = now + 0.01;
        const lvl = LV.teeth * (0.3 + 0.7 * Math.min(1, r / 20)) * (r > 20 ? (30 - r) / 10 : 1);
        for (let n = 0; n < 8 && C[key] < h; n++) {
          this._tooth(C[key], w, 0.22 * lvl, pick(C.taps), null);
          C[key] += (1 / r) * rand(0.97, 1.03);
        }
      }
      return;
    }
    const s = this._crank;
    if (s < 0.02) return;
    const rate = 3 + 19 * s;
    let next = C.lastClick + C.jit / rate;
    if (next < now) next = now + 0.004;
    for (let n = 0; n < 8 && next < h; n++) {
      this._ratchet(next, s, C);
      C.lastClick = next;
      C.jit = rand(0.9, 1.1);
      next += C.jit / rate;
    }
    const rps = 0.3 + 1.45 * s;
    if (!C.nextCreak || C.nextCreak < now - 0.5) C.nextCreak = now + 0.05;
    for (let n = 0; n < 3 && C.nextCreak < h; n++) {
      this._handleCreak(Math.max(C.nextCreak, now + 0.005), s, C);
      C.nextCreak += 1 / rps;
    }
  }

  _ratchet(t, s, C) {
    if (!this._room(1, true)) return;
    const src = this._src(this._buf.ratchet);
    src.playbackRate.value = rand(0.92, 1.08) * (0.94 + 0.12 * s);
    src.connect(pick(C.taps));
    this._fire(src, t, t + 0.06, null, 0);
  }

  _handleCreak(t, s, C) {
    if (!this._room(1, true) || !this._oscRoom(1)) return;
    const dur = rand(0.12, 0.2) * (1.2 - 0.4 * s);
    const f0 = rand(24, 34);
    const o = this._osc('sawtooth', f0);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(rand(38, 55), t + dur);
    const p = this._pan(rand(-0.2, 0.2), C.out);
    const env = this._g(0, p);
    const a = 0.9 * (0.4 + 0.6 * s);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(a, t + dur * 0.3);
    env.gain.setValueAtTime(a, t + dur * 0.65);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const b1 = this._f('bandpass', rand(300, 380), 7, env);
    const g2 = this._g(0.55, env);
    const b2 = this._f('bandpass', rand(760, 900), 9, g2);
    o.connect(b1);
    o.connect(b2);
    this._fire(o, t, t + dur + 0.02, [b1, b2, g2, env, p]);
  }

  _schedAmbience(now, h) {
    const M = has(MODES, this._modeOn) ? MODES[this._modeOn] : null;
    const A = this._airBed;
    if (A) {
      if (M && M.air) { A.offAt = 0; this._airEvents(A, now, h); }
      else if (!A.offAt) A.offAt = now;
      else if (now - A.offAt > 3) { this._retire(A, now + 0.1); this._airBed = null; }
    }
    const W = this._waterBed;
    if (W) {
      if (M && M.water) { W.offAt = 0; this._waterEvents(W, now, h); }
      else if (!W.offAt) W.offAt = now;
      else if (now - W.offAt > 3) { this._retire(W, now + 0.1); this._waterBed = null; }
    }
    if (this._ecl && this._eclA === 0 && now - this._eclIdle > 8) this._killEclipse();
  }

  _airEvents(A, now, h) {
    const n = this._night;
    if (!A.nextLap || A.nextLap < now - 1) A.nextLap = now + rand(0.2, 1);
    for (let i = 0; i < 4 && A.nextLap < h; i++) {
      this._lap(Math.max(A.nextLap, now + 0.005), A);
      A.nextLap += (Math.random() < 0.25 ? rand(0.22, 0.5) : rand(0.8, 4)) * (1 + 0.9 * n);
    }
    if (!A.nextSlosh) A.nextSlosh = now + rand(5, 12);
    if (A.nextSlosh < h) { this._sloshBig(Math.max(A.nextSlosh, now + 0.01), A); A.nextSlosh = now + rand(8, 22); }
    if (A.sw && now > (A.swT || 0)) { A.swT = now + rand(6, 11); setp(A.sw.frequency, 0.085 * rand(0.7, 1.3), now, 2); }
    if (!A.nextGull) A.nextGull = now + rand(2.5, 7);
    if (A.nextGull < h) {
      if (Math.random() > n) this._gullGroup(Math.max(A.nextGull, now + 0.01), A);
      A.nextGull = now + rand(6, 15);
    }
    if (!A.nextCreak) A.nextCreak = now + rand(7, 16);
    if (A.nextCreak < h) {
      this._creak(Math.max(A.nextCreak, now + 0.01), A);
      A.nextCreak = now + (A.variant === 'sea' ? rand(24, 50) : rand(15, 32)) * (1 + 0.6 * n);
    }
    if (!A.nextRig) A.nextRig = now + rand(2, 5);
    if (A.nextRig < h) { this._rigTap(Math.max(A.nextRig, now + 0.01), A); A.nextRig = now + rand(4, 9); }
    if (n > 0.6) {
      if (!A.nextBell) A.nextBell = now + rand(5, 12);
      if (A.nextBell < h) { this._nightBell(Math.max(A.nextBell, now + 0.01), A); A.nextBell = now + rand(30, 55); }
    } else A.nextBell = 0;
  }

  _rigTap(t, A) {
    if (!this._room(3, true)) return;
    const p = this._pan(rand(-0.3, 0.3), A.events);
    const G = this._grp(p);
    const lv = 0.05 * LV.rig * (1 - 0.3 * this._night);
    const top = A.variant === 'sea' ? 1 : 1.5;
    this._nb(t, 420 * rand(0.95, 1.05), 6, lv, 0.001, 0.025, p, G);
    this._nb(t, 1100 * rand(0.95, 1.05), 4, 0.5 * lv * top, 0.001, 0.02, p, G);
    this._nb(t, 2600 * rand(0.93, 1.07), 5, 0.45 * lv * top, 0.0005, 0.008, p, G);
    this._nb(t + 0.001, 5200 * rand(0.93, 1.07), 4, 0.2 * lv * top, 0.0005, 0.005, p, G);
    if (Math.random() < 0.7) this._nb(t + rand(0.06, 0.12), 420, 6, 0.4 * lv, 0.001, 0.025, p, G);
    this._seal(G);
  }

  _lap(t, A, boost = 1) {
    if (!this._room(3, true)) return;
    const sea = A.variant === 'sea';
    const s = rand(0.3, 1) * (1 - 0.45 * this._night) * LV.lap * boost;
    const dur = rand(0.35, 0.8);
    const p = this._pan(rand(-0.7, 0.7), A.events);
    const G = this._grp(p);
    const src = this._noise(this._buf.pink);
    const slap = this._env(t, (sea ? 0.12 : 0.3) * s, 0.004, rand(0.025, 0.05), p);
    const sbp0 = this._f('bandpass', rand(650, 1300), 0.8, slap);
    const slosh = this._env(t + 0.02, (sea ? 0.3 : 0.18) * s, 0.06, dur * 0.45, p);
    const sbp = this._f('bandpass', rand(450, 900), 0.7, slosh);
    const fizz = this._env(t + 0.06, 0.08 * s, 0.05, dur * 0.6, p);
    const fbp = this._f('bandpass', rand(2000, 4500), 0.8, fizz);
    src.connect(sbp0);
    src.connect(sbp);
    src.connect(fbp);
    this._fire(src, t, t + 0.12 + dur * 5, [sbp0, sbp, fbp, slap, slosh, fizz], undefined, G);
    if (!sea) {
      this._nb(t + 0.003, rand(110, 170), 1.2, rand(0.03, 0.06) * s, 0.004, rand(0.05, 0.09), p, G, { buf: this._buf.pink });
    }
    const ng = (sea ? 1 : 2) + ((Math.random() * 3) | 0);
    let tg = t + rand(0.05, 0.12);
    for (let i = 0; i < ng; i++) {
      const f = rand(280, 620);
      const b = this._nb(tg, f, 1.2, rand(0.025, 0.06) * s, 0.006, rand(0.02, 0.045), p, G, { buf: this._buf.pink });
      if (b) b.frequency.exponentialRampToValueAtTime(f * rand(0.6, 0.8), tg + 0.08);
      tg += rand(0.04, 0.16);
    }
    this._seal(G);
  }

  _sloshBig(t, A) {
    if (!this._room(2, true)) return;
    const s = rand(0.5, 1) * (1 - 0.45 * this._night) * LV.lap;
    const d = rand(1, 1.8);
    const p = this._pan(rand(-0.6, 0.6), A.events);
    const G = this._grp(p);
    const src = this._noise(this._buf.pink);
    const e = this._g(0, p);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.16 * s, t + d * 0.3);
    e.gain.setTargetAtTime(0, t + d * 0.35, d * 0.3);
    const bp = this._f('bandpass', rand(500, 800), 0.6, e);
    bp.frequency.setValueAtTime(rand(700, 1000), t);
    bp.frequency.exponentialRampToValueAtTime(rand(350, 500), t + d);
    src.connect(bp);
    this._fire(src, t, t + d * 2.2, [bp, e], undefined, G);
    this._seal(G);
  }

  _gullGroup(t0, A) {
    const n = Math.random() < 0.45 ? 3 : 2;
    const pan = rand(-0.85, 0.85);
    const dist = 0.3 + 0.7 * Math.random();
    const k = rand(0.9, 1.12);
    let t = t0;
    for (let i = 0; i < n; i++) {
      this._gullCall(t, clamp$1(pan + rand(-0.12, 0.12), -1, 1), dist, k * rand(0.96, 1.04), i === n - 1, A);
      t += rand(0.32, 0.55);
    }
  }

  _gullCall(t, pan, dist, k, long, A) {
    if (!this._oscRoom(2) || !this._room(2, true)) return;
    const dur = rand(0.24, 0.36) * (long ? 1.3 : 1);
    const fp = 800 * k;
    const car = this._osc('sawtooth', fp);
    const mod = this._osc('sine', fp * 0.5);
    const idx = this._g(0);
    car.frequency.setValueAtTime(fp * 0.72, t);
    car.frequency.linearRampToValueAtTime(fp, t + 0.045);
    car.frequency.exponentialRampToValueAtTime(fp * 0.56, t + dur);
    mod.frequency.setValueAtTime(fp * 0.36, t);
    mod.frequency.linearRampToValueAtTime(fp * 0.5, t + 0.045);
    mod.frequency.exponentialRampToValueAtTime(fp * 0.28, t + dur);
    idx.gain.setValueAtTime(fp * 0.55, t);
    idx.gain.linearRampToValueAtTime(fp * 0.2, t + dur);
    mod.connect(idx);
    idx.connect(car.frequency);
    const p = this._pan(pan, A.events);
    const send = this._g(0.25 + 0.4 * dist, this._reverb);
    p.connect(send);
    const a = 0.11 * LV.gull * (1 - 0.55 * dist);
    const env = this._g(0, p);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(a, t + 0.02);
    env.gain.setValueAtTime(a, t + dur * 0.55);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const lp = this._f('lowpass', 4800 - 2600 * dist, 0.5, env);
    const bp = this._f('bandpass', 2200 * k, 1.3, lp);
    car.connect(bp);
    const G = this._grp(idx, bp, lp, env, p, send);
    this._fire(car, t, t + dur + 0.02, null, undefined, G);
    this._fire(mod, t, t + dur + 0.02, null, undefined, G);
  }

  _creak(t, A) {
    const lvl = 0.5 * LV.creak * (A.variant === 'sea' ? 0.55 : 1) * (1 - 0.3 * this._night);
    const p = this._pan(rand(-0.6, 0.6), A.events);
    const G = this._grp(p);
    this._woodGrind(t, rand(0.9, 1.8), lvl, p, G);
    this._seal(G);
  }

  _woodGrind(t, dur, lvl, dest, G) {
    if (!this._oscRoom(1) || !this._room(3, true)) return;
    const f0 = rand(8, 15);
    const o = this._osc('sawtooth', f0);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * rand(0.8, 1.1), t + dur);
    const jn = this._noise(this._buf.brown, 0.5);
    const jlp = this._f('lowpass', 12, 0.7);
    const jd = this._g(f0 * 0.5, o.frequency);
    jn.connect(jlp);
    jlp.connect(jd);
    const env = this._g(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + dur * 0.35);
    env.gain.linearRampToValueAtTime(lvl * rand(0.6, 1), t + dur * 0.65);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const lp = this._f('lowpass', 420, 0.6, env);
    const g1 = this._g(1, lp);
    const b1 = this._f('bandpass', rand(100, 160), 1.3, g1);
    const g2 = this._g(0.7, lp);
    const b2 = this._f('bandpass', rand(200, 300), 1.6, g2);
    o.connect(b1);
    o.connect(b2);
    this._fire(o, t, t + dur + 0.02, [b1, g1, b2, g2, lp, env], undefined, G);
    this._fire(jn, t, t + dur + 0.02, [jlp, jd], undefined, G);
    const n = 1 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) this._nb(t + dur * rand(0.15, 0.85), rand(1100, 2200), 1.2, lvl * rand(0.1, 0.2), 0.001, rand(0.004, 0.01), dest, G, { buf: this._buf.grit });
  }

  _nightBell(t, A) {
    const strikes = pick([1, 1, 2, 3]);
    const f = pick([293.66, 220]);
    for (let i = 0; i < strikes; i++) {
      this._bell(t + i * rand(2.8, 3.6), f, 0.14 * LV.nightBell, { dest: A.events, lp: 1600, pan: -0.4, send: 0.6, dur: 7, soft: true, low: true });
    }
  }

  _waterEvents(W, now, h) {
    if (W.nextSnap < now) W.nextSnap = now + rand(0, 0.05);
    for (let i = 0; i < 12 && W.nextSnap < h; i++) {
      this._snap(W.nextSnap, W);
      W.nextSnap += -Math.log(1 - Math.random()) / SNAP_RATE;
    }
    if (!W.nextFish) W.nextFish = now + rand(4, 10);
    if (W.nextFish < h) { this._fish(Math.max(W.nextFish, now + 0.01), W); W.nextFish = now + rand(7, 18); }
    if (!W.nextCreak) W.nextCreak = now + rand(8, 18);
    if (W.nextCreak < h) { this._uwCreak(Math.max(W.nextCreak, now + 0.01), W); W.nextCreak = now + rand(14, 32); }
    if (!W.nextSchool) W.nextSchool = now + rand(0.5, 1.5);
    if (W.nextSchool < h) {
      this._school(Math.max(W.nextSchool, now + 0.01), W);
      W.nextSchool = now + (now < (this._schoolUntil || 0) ? rand(1.5, 3) : this._plume ? rand(4, 9) : rand(20, 40));
    }
    if (!W.nextWhale) W.nextWhale = now + rand(40, 90);
    if (W.nextWhale < h && !W.train) {
      W.train = { next: Math.max(W.nextWhale, now + 0.01), end: W.nextWhale + rand(6, 15), rate: rand(1, 2), pan: rand(-0.7, 0.7) };
      W.nextWhale = now + rand(90, 200);
    }
    const T = W.train;
    if (T) {
      for (let i = 0; i < 4 && T.next < h; i++) {
        if (T.next > T.end) { W.train = null; break; }
        this._spermClick(Math.max(T.next, now + 0.005), T, W);
        T.next += (1 / T.rate) * rand(0.9, 1.1);
      }
    }
  }

  _snap(t, W) {
    if (!this._room(1, true)) return;
    const s = this._src(this._buf.click);
    s.playbackRate.value = rand(0.5, 1.5);
    s.connect(pick(W.snapTaps));
    this._fire(s, t, t + 0.02, null, 0);
  }

  _fish(t, W) {
    if (!this._oscRoom(1) || !this._room(1, true)) return;
    const f = rand(230, 420);
    const n = 3 + ((Math.random() * 5) | 0);
    const sp = rand(0.055, 0.09);
    const o = this._osc('sine', f);
    const a = 0.12 * LV.fish;
    const g = this._g(0);
    for (let i = 0; i < n; i++) {
      const tp = t + i * sp;
      g.gain.setValueAtTime(0, tp);
      g.gain.linearRampToValueAtTime(a * (1 - 0.08 * i), tp + 0.004);
      g.gain.setTargetAtTime(0, tp + 0.004, 0.012);
    }
    const bp = this._f('bandpass', f, 2);
    const p = this._pan(rand(-0.8, 0.8), W.events);
    const send = this._g(0.3, this._reverb);
    o.connect(g);
    g.connect(bp);
    bp.connect(p);
    p.connect(send);
    this._fire(o, t, t + n * sp + 0.12, [g, bp, p, send]);
  }

  _uwCreak(t, W) {
    if (!this._oscRoom(2) || !this._room(2, true)) return;
    const dur = rand(0.6, 1.4);
    const o = this._osc('sawtooth', 22);
    o.frequency.setValueAtTime(rand(18, 26), t);
    o.frequency.linearRampToValueAtTime(rand(28, 40), t + dur);
    const j = this._osc('sine', rand(4, 7));
    const jd = this._g(2.5, o.frequency);
    j.connect(jd);
    const p = this._pan(rand(-0.9, 0.9), W.events);
    const send = this._g(0.7, this._reverb);
    p.connect(send);
    const lp = this._f('lowpass', 900, 0.6, p);
    const env = this._g(0, lp);
    const a = 1.6 * LV.creak * clamp$1(6 / Math.max(6, this._lis.dW), 0.15, 1);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(a, t + dur * 0.35);
    env.gain.setValueAtTime(a, t + dur * 0.6);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const b1 = this._f('bandpass', rand(160, 220), 6, env);
    const g2 = this._g(0.7, env);
    const b2 = this._f('bandpass', rand(380, 460), 8, g2);
    o.connect(b1);
    o.connect(b2);
    const G = this._grp(jd, b1, b2, g2, env, lp, p, send);
    this._fire(o, t, t + dur + 0.05, null, undefined, G);
    this._fire(j, t, t + dur + 0.05, null, undefined, G);
  }

  _spermClick(t, T, W) {
    if (!this._room(2, true)) return;
    const p = this._pan(T.pan, W.events);
    const G = this._grp(p);
    const lv = 0.1 * LV.sperm * rand(0.8, 1.2);
    this._clickAt(t, lv, 3000, p, rand(0.8, 1.1), G);
    this._clickAt(t + rand(0.003, 0.005), lv * 0.5, 2600, p, rand(0.8, 1.1), G);
    this._seal(G);
  }

  _school(t, W) {
    if (!this._oscRoom(1) || !this._room(2, true)) return;
    const d = rand(0.4, 0.7);
    const n = this._noise(this._buf.pink);
    const bp = this._f('bandpass', rand(500, 1500), 1);
    const am = this._g(0.5);
    const p = this._pan(rand(-0.8, 0.8), W.events);
    const e = this._g(0, p);
    const lv = 0.12 * LV.school;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(lv, t + d * 0.4);
    e.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp);
    bp.connect(am);
    am.connect(e);
    const o = this._osc('square', rand(20, 30));
    const od = this._g(0.45, am.gain);
    o.connect(od);
    const G = this._grp(bp, am, e, p);
    this._fire(n, t, t + d + 0.02, null, undefined, G);
    this._fire(o, t, t + d + 0.02, [od], undefined, G);
  }

  _schedSwell(now, h) {
    const S = this._swell;
    if (!S) return;
    if (now - S.t0 > 600) { this._swellEnd(now, false); return; }
    const rate = 0.3 + 1.6 * S.charge;
    if (!S.next || S.next < now - 1) S.next = now + 0.4;
    for (let i = 0; i < 4 && S.next < h; i++) {
      this._bell(Math.max(S.next, now + 0.005), mtof(pick(SPARKLE) - 12), (0.035 + 0.055 * S.charge) * LV.swell,
        { dest: S.fx, pan: rand(-0.8, 0.8), lp: 2600, tau: 0.3, low: true });
      S.next += -Math.log(1 - Math.random()) / rate;
    }
  }

  _schedCue(now, h) {
    const Q = this._cue;
    if (!Q) return;
    if (Q.resolved) {
      if (now > Q.endAt) { this._retire(Q, now + 0.1); this._cue = null; }
      return;
    }
    if (now - Q.last > 4) { this._cueFade(Q, now); return; }
    if (Q.step >= 0) {
      if (!Q.nextGlint) Q.nextGlint = now + rand(0.8, 1.6);
      if (Q.nextGlint < h) {
        const k = Math.max(0, Q.kSet);
        if (Math.random() < 0.35 + 0.65 * k) {
          this._bell(Math.max(Q.nextGlint, now + 0.005), mtof(pick([74, 76, 81, 83, 86, 88])), (0.062 + 0.1 * k) * LV.sunrise,
            { dest: Q.out, pan: rand(-0.7, 0.7), lp: 1900, tau: 0.33, low: true, send: 0.3 });
        }
        Q.nextGlint = now + rand(0.5, 1.1);
      }
    }
    if (Q.queue.length && Q.free < h) {
      const s = Q.queue.shift();
      Q.free = this._cuePhrase(Q, SUN_PHRASES[s], Math.max(Q.free, now + 0.03), 0.5 + 0.12 * s) + 0.25;
    }
  }

  _schedIdle(now, h) {
    const B = this._brushL;
    if (B && B.idleAt && now - B.idleAt > 2.5) { this._retire(B, now + 0.2); this._brushL = null; }
    if (this._descent && this._modeOn === 'underwater') {
      if (this._diveBrAt && this._diveBrAt < h) { this._diveBrAt = 0; this.breathe(); }
      if (!this._nextDiveBreath || this._nextDiveBreath < now - 1) this._nextDiveBreath = now + 0.5;
      if (this._nextDiveBreath < h) { this.breathe(); this._nextDiveBreath = now + rand(4.4, 7.2); }
    } else this._diveBrAt = 0;
    const Hm = this._helmetL;
    if (Hm && this._modeOn === 'underwater') {
      if (Hm.pump && now > (Hm.reT || 0)) { Hm.reT = now + 2; setp(Hm.pump.frequency, Hm.f0 * rand(0.92, 1.08), now, 0.5); }
      const plume = this._plume;
      if (!Hm.next || Hm.next < now - 1) Hm.next = now + (plume ? 0.2 : rand(1.5, 3));
      if (Hm.next < h) {
        const t = Math.max(Hm.next, now + 0.005);
        const p = 1 + this._lis.depth / 10;
        const r = clamp$1(Math.sqrt(2.3 / p), 0.8, 1.35);
        if (plume || t < this._exhaleT - 0.3 || t > this._breathBusy + 0.3) {
          this._bubbles(t, plume ? rand(0.15, 0.32) : rand(0.3, 0.5), rand(0.6, 0.8) * r, { atk: rand(0.03, 0.08), hold: plume ? rand(0.05, 0.14) : 0.06, tau: rand(0.08, 0.16), lp: 1500 }, Hm.out);
        }
        Hm.next = now + (plume ? rand(0.3, 1.2) : rand(2.5, 6));
      }
    }
  }

  _buildEclipse() {
    const E = { srcs: [], nodes: [] };
    E.out = this._g(0, this._musicBus);
    const send = this._g(0.55, this._reverb);
    E.out.connect(send);
    const lp = this._f('lowpass', 3400, 0.5, E.out);
    const g1 = this._g(1.6, lp);
    const g2 = this._g(0.9, lp);
    const g3 = this._g(0.45, lp);
    const g4 = this._g(0.25, lp);
    E.f1 = this._f('bandpass', 380, 5, g1);
    E.f2 = this._f('bandpass', 760, 7, g2);
    E.f3 = this._f('bandpass', 2450, 10, g3);
    const body = this._f('lowpass', 240, 0.5, g4);
    const mix = this._g(1);
    for (const f of [E.f1, E.f2, E.f3, body]) mix.connect(f);
    const sides = [this._pan(-0.55, mix), this._pan(0.55, mix)];
    const vA = this._live(this._osc('sine', 4.7));
    const vB = this._live(this._osc('sine', 5.3));
    const dA = this._g(6);
    const dB = this._g(6);
    vA.connect(dA);
    vB.connect(dB);
    E.srcs.push(vA, vB);
    E.nodes.push(send, lp, g1, g2, g3, g4, E.f1, E.f2, E.f3, body, mix, dA, dB, ...sides);
    ECL_VOICES.forEach(([m, lv], i) => {
      const o = this._osc('sawtooth', mtof(m));
      o.detune.value = i % 2 ? 8 : -9;
      (i % 2 ? dA : dB).connect(o.detune);
      const g = this._g(lv * 0.7, sides[i % 2]);
      o.connect(g);
      E.srcs.push(this._live(o));
      E.nodes.push(g);
    });
    E.shim = this._g(0, E.out);
    const tr = this._live(this._osc('sine', 0.31));
    E.srcs.push(tr);
    [86, 93, 100].forEach((m) => {
      const o = this._osc('sine', mtof(m));
      const tg = this._g(0.5, E.shim);
      const ld = this._mod(tr, 0.5, tg.gain);
      o.connect(tg);
      E.srcs.push(this._live(o));
      E.nodes.push(tg, ld);
    });
    this._ecl = E;
  }

  _killEclipse() {
    const E = this._ecl;
    this._ecl = null;
    if (!E) return;
    const t = this._ctx.currentTime;
    setp(E.out.gain, 0, t, 0.02);
    this._retire(E, t + 0.2);
  }


  _lyre(t, midi, vel, pan = 0, o = {}) {
    const music = !o.dest;
    if ((music && this._lyreVoices >= MAX_LYRE) || !this._room(2, music) || !this._oscRoom(1)) return;
    const f = mtof(midi);
    const v = clamp$1(vel, 0.05, 1);
    const amp = 0.26 * v;
    const tau = clamp$1((o.decay || 1) * (0.95 - (midi - 62) * 0.018), 0.25, 1.4);
    const osc = this._osc('sine', f);
    osc.setPeriodicWave(this._lyreWave);
    osc.detune.setValueAtTime(10 * v, t);
    osc.detune.setTargetAtTime(0, t, 0.03);
    const env = this._g(0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amp, t + 0.003);
    env.gain.setTargetAtTime(0, t + 0.003, tau);
    const lp = this._f('lowpass', f * 8, 0.6, env);
    lp.frequency.setValueAtTime(Math.min(12000, f * (5 + 8 * v)), t);
    lp.frequency.setTargetAtTime(Math.max(f * 1.8, 350), t + 0.01, 0.1 + 0.12 * tau);
    const nz = this._noise(this._buf.white);
    const ng = this._g(0, lp);
    ng.gain.setValueAtTime(amp * 0.5, t);
    ng.gain.setTargetAtTime(0, t, 0.004);
    nz.connect(ng);
    osc.connect(lp);
    let p = null;
    if (music) env.connect(this._nearest(this._lyreTaps, LYRE_PANS, pan));
    else { p = this._pan(pan, o.dest); env.connect(p); }
    const H = this._sub(o.grp, lp, env, p);
    if (music) { this._lyreVoices++; H.onDone = () => { this._lyreVoices--; }; }
    this._fire(nz, t, t + 0.05, [ng], undefined, H);
    this._fire(osc, t, t + 0.003 + tau * 6.5, null, undefined, H);
  }

  _bell(t, f, gain, o = {}) {
    if (!this._room(1, !!o.low)) return;
    const b = this._buf.bell;
    const r = clamp$1(f / BELL_F0, 0.1, 8);
    const atk = o.soft ? 0.012 : 0.001;
    const dur = Math.max(0.3, Math.min(o.dur || 6, b.duration / r, o.tau ? atk + 7 * o.tau : 99));
    const src = this._src(b);
    src.playbackRate.value = r;
    const p = this._pan(o.pan || 0, o.dest || this._sfxBus);
    const env = this._g(0, p);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + atk);
    if (o.tau) env.gain.setTargetAtTime(0, t + atk, o.tau);
    else {
      env.gain.setValueAtTime(gain, t + Math.max(atk, dur - 0.25));
      env.gain.linearRampToValueAtTime(0, t + dur);
    }
    const nodes = [env, p];
    let head = env;
    if (o.lp) { head = this._f('lowpass', o.lp, 0.6, env); nodes.push(head); }
    src.connect(head);
    if (o.send) { const s = this._g(o.send, this._reverb); p.connect(s); nodes.push(s); }
    this._fire(src, t, t + dur + 0.01, nodes, 0, o.grp);
  }

  _bubbles(t, peak, rate, o, dest, G) {
    if (!this._room(1, true)) return;
    const b = this._buf.bubbles;
    const atk = o.atk || 0.04;
    const avail = (b.duration - 0.05) / rate;
    const hold = Math.min(o.hold || 0, Math.max(0, avail - atk - 0.2));
    const tau = Math.max(0.03, Math.min(o.tau || 0.3, (avail - atk - hold) / 6));
    const len = atk + hold + 6 * tau;
    const off = rand(0, Math.max(0, b.duration - len * rate - 0.02));
    const src = this._src(b);
    src.playbackRate.value = rate;
    const env = this._g(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + atk);
    env.gain.setValueAtTime(peak, t + atk + hold);
    env.gain.setTargetAtTime(0, t + atk + hold, tau);
    const nodes = [env];
    let head = env;
    if (o.lp) { head = this._f('lowpass', o.lp, 0.6, head); nodes.push(head); }
    if (o.hp) { head = this._f('highpass', o.hp, 0.6, head); nodes.push(head); }
    src.connect(head);
    this._fire(src, t, t + len, nodes, off, G);
  }

  _drop(t, rate, gain, pan, dest, G) {
    if (!this._room(1, true)) return;
    const src = this._src(this._buf.drops);
    src.playbackRate.value = rate;
    const p = this._pan(pan, dest);
    const g = this._g(gain, p);
    src.connect(g);
    this._fire(src, t, t + DROP_SLOT / rate, [g, p], ((Math.random() * DROP_N) | 0) * DROP_SLOT, G);
  }

  _clickAt(t, gain, freq, dest, rate = 1, G) {
    if (!this._room(1, true)) return;
    const src = this._src(this._buf.click);
    src.playbackRate.value = rate;
    const g = this._g(gain, dest);
    const bp = this._f('bandpass', freq, 1.5, g);
    src.connect(bp);
    this._fire(src, t, t + 0.02, [bp, g], 0, G);
  }

  _choir(t, notes, lvl, dur, vowel, dest, G) {
    if (!this._oscRoom(notes.length + 1) || !this._room(notes.length + 1)) return;
    const F = VOWELS[vowel] || VOWELS.ah;
    const env = this._g(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + 0.45);
    env.gain.setValueAtTime(lvl, t + 0.45 + dur * 0.25);
    env.gain.setTargetAtTime(0, t + 0.45 + dur * 0.25, dur * 0.25);
    const lp = this._f('lowpass', 3200, 0.5, env);
    const mix = this._g(1);
    const bands = [[F[0], 4, 1.5], [F[1], 6, 0.8], [F[2], 9, 0.3]].flatMap(([f, q, g]) => {
      const gg = this._g(g, lp);
      const bp = this._f('bandpass', f, q, gg);
      mix.connect(bp);
      return [bp, gg];
    });
    const vib = this._osc('sine', 4.8);
    const vd = this._g(7);
    vib.connect(vd);
    const H = this._sub(G, env, lp, mix, vd, ...bands);
    const end = t + 0.45 + dur * 0.25 + dur * 0.25 * 5.5;
    notes.forEach((m, i) => {
      const o = this._osc('sawtooth', mtof(m));
      o.detune.value = i % 2 ? 7 : -7;
      vd.connect(o.detune);
      o.connect(mix);
      this._fire(o, t, end, null, undefined, H);
    });
    this._fire(vib, t, end, null, undefined, H);
  }

  _swellTone(t, f, lvl, dur, dest, G) {
    if (!this._oscRoom(2) || !this._room(2)) return;
    const env = this._g(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + 0.4);
    env.gain.setTargetAtTime(0, t + 0.5, dur * 0.22);
    const o1 = this._osc('sine', f);
    const o2 = this._osc('sine', f * 1.5);
    const g2 = this._g(0.35, env);
    o1.connect(env);
    o2.connect(g2);
    const H = this._sub(G, env, g2);
    const end = t + 0.5 + dur * 1.45;
    this._fire(o1, t, end, null, undefined, H);
    this._fire(o2, t, end, null, undefined, H);
  }

  _bloom(t, notes, dur, lvl, dest, G) {
    if (!this._oscRoom(notes.length) || !this._room(notes.length)) return;
    const env = this._g(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(lvl, t + 0.12);
    env.gain.setTargetAtTime(0, t + 0.5, dur * 0.3);
    const lp = this._f('lowpass', 500, 1, env);
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.setTargetAtTime(2600, t, 0.08);
    lp.frequency.setTargetAtTime(900, t + 0.5, dur * 0.35);
    const H = this._sub(G, lp, env);
    const end = t + 0.5 + dur * 2.1;
    notes.forEach((m, i) => {
      const o = this._osc(i % 2 ? 'triangle' : 'sawtooth', mtof(m));
      o.detune.value = i % 2 ? 5 : -5;
      o.connect(lp);
      this._fire(o, t, end, null, undefined, H);
    });
  }

  _boom(t, lvl, dest, G) {
    if (!this._oscRoom(2) || !this._room(2)) return;
    const env = this._env(t, lvl, 0.012, 0.38, dest);
    const o = this._osc('sine', 70);
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
    const o2 = this._osc('triangle', 140);
    o2.frequency.setValueAtTime(140, t);
    o2.frequency.exponentialRampToValueAtTime(76, t + 0.6);
    const g2 = this._g(0.3, env);
    o.connect(env);
    o2.connect(g2);
    const H = this._sub(G, env, g2);
    this._fire(o, t, t + 2.8, null, undefined, H);
    this._fire(o2, t, t + 2.8, null, undefined, H);
  }

  _kymbal(t, lvl, dest, G) {
    if (!this._room(1, true)) return;
    const n = this._noise(this._buf.white);
    const hp = this._f('highpass', 2500, 0.7);
    const pk = this._f('peaking', 5200, 1.5);
    pk.gain.value = 6;
    const lp = this._f('lowpass', 11000, 0.7);
    const e = this._g(0, dest);
    const s = this._g(0.5, this._reverb);
    e.connect(s);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(lvl, t + 0.18);
    e.gain.setTargetAtTime(0, t + 0.35, 1.4);
    n.connect(hp);
    hp.connect(pk);
    pk.connect(lp);
    lp.connect(e);
    this._fire(n, t, t + 0.35 + 1.4 * 6, [hp, pk, lp, e, s], undefined, G);
  }

  _air(t, dur, lvl, dest, G) {
    if (!this._room(1, true)) return;
    const g = this._g(0, dest);
    const s = this._g(0.6, this._reverb);
    g.connect(s);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.04);
    g.gain.setTargetAtTime(0, t + 0.06, dur / 3);
    const hp = this._f('highpass', 6500, 0.7, g);
    const n = this._noise(this._buf.white);
    n.connect(hp);
    this._fire(n, t, t + 0.06 + dur * 2.4, [hp, g, s], undefined, G);
  }

  _drum(t, v, k) {
    if (!this._room(2, true) || !this._oscRoom(1)) return;
    const o = this._osc('sine', 92);
    o.frequency.setValueAtTime(92, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.14);
    const e = this._env(t, 0.5 * v, 0.003, 0.11 + 0.04 * k, this._pulseGain);
    o.connect(e);
    this._fire(o, t, t + 0.9, [e]);
    const n = this._noise(this._buf.pink);
    const e2 = this._env(t, 0.22 * v, 0.002, 0.05, this._pulseGain);
    const bp = this._f('bandpass', 170 + 60 * k, 1.1, e2);
    n.connect(bp);
    this._fire(n, t, t + 0.45, [bp, e2]);
  }

  _shimmer(t, ch) {
    const lad = this._ladder(ch.pcs, 72);
    this._bell(t, mtof(lad[(Math.random() * 3) | 0]), rand(0.035, 0.06),
      { dest: this._shimmerGain, pan: rand(-0.7, 0.7), send: 0.35, lp: 1900, tau: 0.33, low: true });
  }

  _duckMusic(depth, holdFor) {
    if (this._cue && !this._cue.resolved) return;
    const t = this._ctx.currentTime;
    const p = this._scoreDuck.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(1 - depth, t, 0.06);
    p.setTargetAtTime(1, t + holdFor, 0.7);
  }


  _g(v = 1, dest) {
    const g = this._ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }

  _f(type, freq, q, dest) {
    const f = this._ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    if (dest) f.connect(dest);
    return f;
  }

  _osc(type, freq) {
    const o = this._ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  _src(buf, loop = false) {
    const s = this._ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    return s;
  }

  _noise(buf, rate = 1) {
    const s = this._src(buf, true);
    if (rate !== 1) s.playbackRate.value = rate;
    s._off = Math.random() * buf.duration * 0.95;
    return s;
  }

  _mod(src, depth, param) {
    const g = this._g(depth);
    src.connect(g);
    g.connect(param);
    return g;
  }

  _env(t, peak, atk, tau, dest) {
    const g = this._g(0, dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.setTargetAtTime(0, t + atk, tau);
    return g;
  }

  _pan(p, dest) {
    const ctx = this._ctx;
    const n = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : ctx.createGain();
    if (n.pan) n.pan.value = clamp$1(p, -1, 1);
    if (dest) n.connect(dest);
    return n;
  }

  _taps(dest, pans, gains) {
    return pans.map((p, i) => {
      const pn = this._pan(p, dest);
      return gains ? this._g(gains[i], pn) : pn;
    });
  }

  _nearest(taps, pans, p) {
    let best = 0;
    for (let i = 1; i < pans.length; i++) if (Math.abs(pans[i] - p) < Math.abs(pans[best] - p)) best = i;
    return taps[best];
  }

  _room(n = 1, low = false) { return this._voices + n <= (low ? VOICE_SOFT : VOICE_HARD); }

  _oscRoom(n = 1) { return this._oscs + n <= OSC_CAP; }

  _grp(...shared) { return { n: 0, shared: shared.filter(Boolean), parent: null, onDone: null }; }

  _sub(parent, ...shared) {
    const G = this._grp(...shared);
    if (parent) { G.parent = parent; parent.n++; }
    return G;
  }

  _grpEnd(G) {
    if (--G.n > 0) return;
    drop(...G.shared);
    if (G.onDone) G.onDone();
    if (G.parent) this._grpEnd(G.parent);
  }

  _seal(G) {
    if (G && G.n === 0) { G.n = 1; this._grpEnd(G); }
  }

  _fire(src, t, stopAt, nodes, offset, G) {
    const isOsc = 'frequency' in src;
    this._voices++;
    if (isOsc) this._oscs++;
    if (G) G.n++;
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      this._voices--;
      if (isOsc) this._oscs--;
      drop(src);
      if (nodes) drop(...nodes);
      if (G) this._grpEnd(G);
    };
    src.onended = end;
    try {
      const off = offset !== undefined ? offset : src._off;
      if (off !== undefined) src.start(t, off);
      else src.start(t);
      src.stop(Math.max(t + 0.005, stopAt));
    } catch (e) {
      this._note(e);
      end();
    }
  }

  _live(src, offset) {
    this._persist++;
    src.onended = () => {
      this._persist--;
      drop(src);
      if (src._after) src._after();
    };
    try {
      const off = offset !== undefined ? offset : src._off;
      if (off !== undefined) src.start(this._ctx.currentTime, off);
      else src.start(this._ctx.currentTime);
    } catch (e) { this._note(e); }
    return src;
  }
}

var audio = Object.freeze({
  __proto__: null,
  AudioEngine: AudioEngine
});

