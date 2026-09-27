// ガザミ拾いの音（蛤突きの音のしくみを元に、別のものとして作り直した）
// ・波と風は町の音素材（assets/sfx/town）を借りる（無ければ合成で代わり）。夜の虫（スズムシ・コオロギ）は合成
// ・手ざわり（なでる砂・コツ・ザリ・いてっ）は手に来る音なので、水でこもらせない（feel の系統）
// ・挟まれた「いてーっ」はマンガのように大げさに。帰るときは、しょんぼりしたラッパ
// ・音楽はヨナ抜き音階（ド レ ミ ソ ラ）の、夜の静かな琴

const YONA = [0, 2, 4, 7, 9];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const scaleNote = (base, idx) => {
  const o = Math.floor(idx / 5), k = ((idx % 5) + 5) % 5;
  return base + o * 12 + YONA[k];
};
const SFX_DIR = new URL('../../../assets/sfx/town/', import.meta.url).href;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.9, amb: 0.8 };
    this.ksCache = new Map();
    this.musicMode = 'none';
    this.nextPhrase = 0;
    this.samples = {};
    this.mode = 'off';
    this.bugT = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.sr = ctx.sampleRate;
    this.master = ctx.createGain();
    this.master.gain.value = this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    this.feel = ctx.createGain(); this.feel.gain.value = this.vol.sfx; this.feel.connect(this.master);
    this.ui = ctx.createGain(); this.ui.gain.value = this.vol.sfx; this.ui.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0; this.amb.connect(this.master);
    // 音楽
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2000;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    this.delay.connect(wet).connect(this.music);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.music); this.musicIn.connect(this.delay);

    this.white = this.makeNoise('white', 2.5);
    this.brown = this.makeNoise('brown', 4);
    this.buildAmbience();
    this.buildStroke();
    this.loadSamples();
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music, t, 0.05);
    for (const b of [this.sfx, this.feel, this.ui]) b.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.setAmbience(this.mode);
  }

  makeNoise(kind, sec) {
    const n = Math.floor(this.sr * sec);
    const buf = this.ctx.createBuffer(1, n, this.sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  src(buf, loop = false) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }

  // ───── 環境音 ─────
  buildAmbience() {
    const ctx = this.ctx;
    // 合成の波（素材が読めない時の代わり）
    this.surf = ctx.createGain(); this.surf.gain.value = 0.3; this.surf.connect(this.amb);
    const wave = this.src(this.white, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.5;
    this.surfSynth = ctx.createGain(); this.surfSynth.gain.value = 0.1;
    wave.connect(bp).connect(this.surfSynth).connect(this.surf);
    wave.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lg = ctx.createGain(); lg.gain.value = 0.07;
    lfo.connect(lg).connect(this.surfSynth.gain); lfo.start();
    // 足もとの水（ちゃぷちゃぷ）
    const lap = this.src(this.white, true);
    const lbp = ctx.createBiquadFilter(); lbp.type = 'bandpass'; lbp.frequency.value = 900; lbp.Q.value = 1.1;
    this.lapG = ctx.createGain(); this.lapG.gain.value = 0;
    lap.connect(lbp).connect(this.lapG).connect(this.amb);
    lap.start(0, 0.7);
    this.lapBp = lbp;
    // 砂丘の草むらの虫: スズムシ（リーン）とコオロギ（コロコロ）。右と左の奥から
    // 遠くでかすかに（大きいとうるさい）
    this.bugs = ctx.createGain(); this.bugs.gain.value = 0.05; this.bugs.connect(this.amb);
    const bl = ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 6500;
    this.bugBus = bl; bl.connect(this.bugs);
  }

  /** 虫の声（updateMusic から少しずつ鳴らす） */
  bugTick(dt) {
    if (!this.ctx || this.mode === 'off') return;
    this.bugT -= dt;
    if (this.bugT > 0) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.8 - 0.9;
    pan.connect(this.bugBus);
    if (Math.random() < 0.55) {
      // スズムシ: 4.5kHz ほどの「リーン」を 2〜4 回
      const f = 4300 + Math.random() * 500;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const am = ctx.createOscillator(); am.frequency.value = 38 + Math.random() * 6;
        const amg = ctx.createGain(); amg.gain.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 0;
        am.connect(amg).connect(g.gain);
        const s = t0 + i * 0.5;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.018, s + 0.04);
        g.gain.setValueAtTime(0.018, s + 0.28);
        g.gain.linearRampToValueAtTime(0, s + 0.36);
        o.connect(g).connect(pan);
        o.start(s); am.start(s); o.stop(s + 0.4); am.stop(s + 0.4);
      }
      this.bugT = 0.9 + Math.random() * 1.6;
    } else {
      // コオロギ: 「コロコロリー」細かい刻み
      const f = 3600 + Math.random() * 600;
      const n = 6 + Math.floor(Math.random() * 8);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        const s = t0 + i * 0.045;
        this.env(g, s, 0.004, 0.012, 0.03);
        o.connect(g).connect(pan);
        o.start(s); o.stop(s + 0.05);
      }
      this.bugT = 0.6 + Math.random() * 1.4;
    }
  }

  async loadSamples() {
    const want = { waves: 'waves.mp3', wind: 'wind-soft.mp3' };
    await Promise.all(Object.entries(want).map(async ([k, f]) => {
      try {
        const r = await fetch(SFX_DIR + f);
        if (!r.ok) return;
        this.samples[k] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* 無くても合成で鳴らす */ }
    }));
    const ctx = this.ctx;
    const loop = (buf, gain, dest = this.amb, off = 0) => {
      const s = this.src(buf, true);
      const g = ctx.createGain(); g.gain.value = gain;
      s.connect(g).connect(dest);
      s.start(0, off);
      return g;
    };
    if (this.samples.waves) { loop(this.samples.waves, 0.5, this.surf); this.surfSynth.gain.value = 0.03; }
    if (this.samples.wind) loop(this.samples.wind, 0.12, this.amb, 5);
  }

  /** mode: 'beach' | 'title' | 'results' | 'off' */
  setAmbience(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = mode === 'off' ? 0 : mode === 'title' ? 0.8 : mode === 'results' ? 0.6 : 1;
    this.amb.gain.setTargetAtTime(v * this.vol.amb, t, 0.4);
  }
  setLap(k) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lapG.gain.setTargetAtTime(0.02 + k * 0.09, t, 0.15);
    this.lapBp.frequency.setTargetAtTime(700 + k * 600, t, 0.2);
  }

  // ───── なでる砂（手を動かしている間ずっと） ─────
  buildStroke() {
    const ctx = this.ctx;
    const n = this.src(this.white, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    this.strokeG = ctx.createGain(); this.strokeG.gain.value = 0;
    n.connect(bp).connect(this.strokeG).connect(this.feel);
    n.start(0, 0.3);
    this.strokeBp = bp;
    // 水をかき回す低い音
    const w = this.src(this.brown, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    this.swishG = ctx.createGain(); this.swishG.gain.value = 0;
    w.connect(lp).connect(this.swishG).connect(this.sfx);
    w.start(0, 1.1);
  }
  /** なでる強さ（0..1）と、手の速さ（0..1） */
  setStroke(k, speed = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.strokeG.gain.setTargetAtTime(k * (0.025 + speed * 0.05), t, 0.05);
    this.strokeBp.frequency.setTargetAtTime(1000 + speed * 1600, t, 0.05);
    this.swishG.gain.setTargetAtTime(k * (0.05 + speed * 0.06), t, 0.08);
  }

  // ───── 基本部品 ─────
  env(g, t, a, peak, d, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }
  noiseBurst({ dest = this.sfx, t = 0, dur = 0.2, type = 'bandpass', f = 800, f2 = null, Q = 1, gain = 0.3, a = 0.005, buf = this.white, pan = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + t;
    const s = this.src(buf);
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = Q;
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, a, gain, dur);
    let node = s.connect(flt).connect(g);
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(dest);
    s.start(t0, Math.random() * 1.5, dur + a + 0.05);
  }
  tone({ dest = this.sfx, t = 0, type = 'sine', f = 440, f2 = null, dur = 0.2, gain = 0.2, a = 0.003, pan = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, a, gain, dur);
    let node = o.connect(g);
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(dest);
    o.start(t0); o.stop(t0 + a + dur + 0.05);
  }
  ks(freq, dur = 1.6, bright = 0.5) {
    const key = `${Math.round(freq)}|${dur}|${bright}`;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const sr = this.sr, n = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const line = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev + (w - prev) * (0.25 + bright * 0.75); line[i] = prev; }
    let idx = 0, last = 0;
    const decay = 0.996 + bright * 0.0025;
    for (let i = 0; i < n; i++) {
      const cur = line[idx], nxt = line[(idx + 1) % N];
      line[idx] = (cur + nxt) * 0.5 * decay;
      d[i] = cur * 0.9 + (cur - last) * 0.25;
      last = cur;
      idx = (idx + 1) % N;
    }
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    this.ksCache.set(key, buf);
    return buf;
  }
  pluck(m, { t = 0, gain = 0.3, dest = null, dur = 1.6, bright = 0.55 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const s = this.src(this.ks(midi(m), dur, bright));
    const g = this.ctx.createGain(); g.gain.value = gain;
    s.connect(g).connect(dest || this.musicIn);
    s.start(t0);
  }
  taiko(t = 0, gain = 0.7, f = 72, dest = null) {
    this.tone({ dest: dest || this.ui, t, f: f * 1.6, f2: f, dur: 0.45, gain, a: 0.002 });
    this.noiseBurst({ dest: dest || this.ui, t, dur: 0.12, type: 'lowpass', f: 900, gain: gain * 0.5 });
  }

  // ───── 手ざわり ─────
  /** 甲羅の棘にさわった: チクッ（高く鋭い）＋手を引っこめる水音 */
  prick(pan = 0) {
    const F = this.feel;
    this.noiseBurst({ dest: F, dur: 0.012, type: 'highpass', f: 6000, gain: 0.3, a: 0.0005, pan });
    this.tone({ dest: F, f: 3200, f2: 2100, dur: 0.05, gain: 0.16, a: 0.001, pan });
    this.tone({ dest: F, t: 0.01, f: 1300, f2: 900, dur: 0.07, gain: 0.1, pan });
    // ビクッ（手を引く水の音）
    this.noiseBurst({ t: 0.03, dur: 0.18, type: 'bandpass', f: 1500, f2: 700, Q: 0.8, gain: 0.12, a: 0.01, pan });
    // マンガの「ピョコ」
    this.tone({ dest: this.ui, t: 0.02, type: 'triangle', f: 900, f2: 1700, dur: 0.09, gain: 0.07 });
  }
  /** 石（コツ）・貝殻（ザリ） */
  hard(kind, pan = 0) {
    const F = this.feel;
    if (kind === 'ishi') {
      this.tone({ dest: F, f: 190, f2: 110, dur: 0.06, gain: 0.25, pan });
      this.noiseBurst({ dest: F, dur: 0.05, type: 'lowpass', f: 1100, gain: 0.18, a: 0.001, pan });
    } else {
      for (let i = 0; i < 3; i++) this.noiseBurst({ dest: F, t: i * 0.018, dur: 0.02, type: 'bandpass', f: 3500 + Math.random() * 1500, Q: 2, gain: 0.08, a: 0.001, pan });
    }
  }
  /** 手を砂に突っ込む: ザブッ＋ザクッ */
  plunge() {
    this.noiseBurst({ dur: 0.22, type: 'bandpass', f: 1200, f2: 500, Q: 0.7, gain: 0.2, a: 0.005 });
    this.noiseBurst({ t: 0.08, dur: 0.12, type: 'lowpass', f: 450, gain: 0.22, a: 0.003, buf: this.brown });
    for (let i = 0; i < 4; i++) this.noiseBurst({ dest: this.feel, t: 0.1 + i * 0.012, dur: 0.012, type: 'highpass', f: 2600 + Math.random() * 2500, gain: 0.05, a: 0.001 });
  }
  /** つかんだ: カニがハサミを鳴らす・脚をばたつかせる */
  grabbed() {
    this.tone({ dest: this.feel, f: 700, f2: 420, dur: 0.05, gain: 0.2 });
    for (let i = 0; i < 4; i++) this.clack(0.05 + i * 0.07 + Math.random() * 0.03, 0.6);
  }
  clack(t = 0, k = 1) {
    const f = 2400 + Math.random() * 1200;
    this.noiseBurst({ dest: this.feel, t, dur: 0.01, type: 'bandpass', f, Q: 4, gain: 0.12 * k, a: 0.0005 });
    this.tone({ dest: this.feel, t, f: f * 0.6, dur: 0.02, gain: 0.05 * k });
  }
  splash(big = 1) {
    this.noiseBurst({ dur: 0.45 * big, type: 'highpass', f: 1100, gain: 0.2 * big, a: 0.008 });
    this.noiseBurst({ dur: 0.3, type: 'lowpass', f: 700, gain: 0.16 * big });
    for (let i = 0; i < 4; i++) this.drip(0.08 + i * 0.08 + Math.random() * 0.05, 0.5);
  }
  drip(t = 0, k = 1) {
    const f = 900 + Math.random() * 1400;
    this.tone({ t, f, f2: f * 1.9, dur: 0.05, gain: 0.045 * k });
  }
  /** 網袋に入れた: ガサッ＋ポン */
  bag(n = 0) {
    this.noiseBurst({ dest: this.ui, dur: 0.1, type: 'bandpass', f: 700, gain: 0.1 });
    const m = scaleNote(72, n % 5);
    this.pluck(m, { dest: this.ui, gain: 0.16, dur: 0.6, bright: 0.7 });
  }

  // ───── 挟まれた ─────
  /** ガチッ！＋ズキーン＋ビヨーン（マンガのように） */
  pinch() {
    if (!this.ctx) return;
    const F = this.feel;
    // ハサミが閉じる
    this.noiseBurst({ dest: F, dur: 0.02, type: 'highpass', f: 2500, gain: 0.5, a: 0.0005 });
    this.tone({ dest: F, f: 900, f2: 300, dur: 0.07, gain: 0.35 });
    this.tone({ dest: F, f: 150, f2: 60, dur: 0.2, gain: 0.5 });
    // ズキーン（高い電気のような音がふるえる）
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1760;
    const vib = ctx.createOscillator(); vib.frequency.value = 28;
    const vg = ctx.createGain(); vg.gain.value = 90;
    vib.connect(vg).connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const g = ctx.createGain();
    this.env(g, t0, 0.01, 0.07, 0.7);
    o.connect(lp).connect(g).connect(this.ui);
    o.start(t0); vib.start(t0); o.stop(t0 + 0.8); vib.stop(t0 + 0.8);
    // ビヨーン
    this.tone({ dest: this.ui, t: 0.25, type: 'triangle', f: 620, f2: 180, dur: 0.55, gain: 0.12 });
    this.taiko(0.02, 0.5, 60);
  }
  /** 手をぶんぶん振る */
  shake(k = 1) { this.noiseBurst({ dur: 0.14, type: 'bandpass', f: 900 + Math.random() * 400, f2: 400, Q: 0.6, gain: 0.08 * k, a: 0.02 }); }
  /** 振りほどいた: ポーン（飛んでいく） */
  fling() {
    this.tone({ dest: this.ui, type: 'triangle', f: 500, f2: 1400, dur: 0.25, gain: 0.1 });
    this.noiseBurst({ dur: 0.25, type: 'bandpass', f: 1500, f2: 3000, Q: 0.8, gain: 0.08, a: 0.01 });
  }
  /** 絆創膏を巻く: ペタッ */
  bandaid() {
    this.noiseBurst({ dest: this.ui, dur: 0.05, type: 'bandpass', f: 1800, Q: 1.5, gain: 0.12, a: 0.002 });
    this.tone({ dest: this.ui, t: 0.03, f: 600, f2: 400, dur: 0.06, gain: 0.08 });
  }
  /** もう帰るぅ…（しょんぼりラッパ: ワ・ワ・ワ・ワ〜ン） */
  sadTrombone() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const notes = [[0, 311, 0.34], [0.42, 294, 0.34], [0.84, 277, 0.34], [1.26, 262, 1.3]];
    for (const [t, f, d] of notes) {
      const t0 = ctx.currentTime + t;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0);
      if (d > 1) {
        const vib = ctx.createOscillator(); vib.frequency.value = 6;
        const vg = ctx.createGain(); vg.gain.value = 0;
        vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(9, t0 + 0.4);
        vib.connect(vg).connect(o.frequency); vib.start(t0); vib.stop(t0 + d + 0.1);
        o.frequency.linearRampToValueAtTime(f * 0.94, t0 + d);
      }
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.05);
      g.gain.setValueAtTime(0.13, t0 + d - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(lp).connect(g).connect(this.ui);
      o.start(t0); o.stop(t0 + d + 0.05);
    }
  }

  // ───── UI・ジングル ─────
  pickup(big = 0) {
    const seq = big ? [0, 2, 4, 5, 7] : [0, 2, 4];
    seq.forEach((k, i) => this.pluck(scaleNote(67, k), { dest: this.ui, t: i * 0.07, gain: 0.22, bright: 0.72 }));
  }
  celebrate() {
    this.taiko(0, 0.8, 70); this.taiko(0.3, 0.8, 70); this.taiko(0.58, 0.6, 80); this.taiko(0.74, 0.9, 64);
    [0, 1, 2, 4, 3, 4, 5, 7].forEach((k, i) => this.pluck(scaleNote(64, k), { dest: this.ui, t: 0.9 + i * 0.1, gain: 0.3, bright: 0.75 }));
    this.pluck(scaleNote(52, 0), { dest: this.ui, t: 0.9, gain: 0.28, dur: 2.5 });
  }
  /** 10 匹ごと: 太鼓とかけ声のかわりの上り */
  milestone() {
    this.taiko(0, 0.7, 72); this.taiko(0.16, 0.7, 72);
    [0, 2, 4, 7].forEach((k, i) => this.pluck(scaleNote(69, k), { dest: this.ui, t: 0.3 + i * 0.07, gain: 0.26, bright: 0.8 }));
  }
  combo(n) { this.pluck(scaleNote(72, Math.min(n, 9)), { dest: this.ui, gain: 0.18, dur: 0.5, bright: 0.8 }); }
  miss() {
    this.pluck(scaleNote(62, 2), { dest: this.ui, gain: 0.16, bright: 0.4 });
    this.pluck(scaleNote(62, 0), { dest: this.ui, t: 0.14, gain: 0.16, bright: 0.35 });
  }
  uiHover() { this.tone({ dest: this.ui, f: 1900, dur: 0.03, gain: 0.025 }); }
  uiClick() { this.pluck(scaleNote(72, 0), { dest: this.ui, gain: 0.2, dur: 0.6 }); }
  stamp() { this.tone({ dest: this.ui, f: 120, f2: 50, dur: 0.2, gain: 0.6 }); this.noiseBurst({ dest: this.ui, dur: 0.1, type: 'lowpass', f: 1800, gain: 0.3 }); }
  coin() { this.tone({ dest: this.ui, f: 1800, dur: 0.06, gain: 0.07 }); this.tone({ dest: this.ui, t: 0.05, f: 2700, dur: 0.12, gain: 0.06 }); }
  bell() { [0, 0.6].forEach((t) => { this.tone({ dest: this.ui, t, f: 1320, dur: 1.2, gain: 0.12 }); this.tone({ dest: this.ui, t, f: 2640 * 1.01, dur: 0.6, gain: 0.04 }); }); }

  // ───── 音楽 ─────
  setMusic(mode) { this.musicMode = mode; this.nextPhrase = 0; }
  updateMusic(dt) {
    this.bugTick(dt);
    if (!this.ctx || this.musicMode === 'none') return;
    this.nextPhrase -= dt;
    if (this.nextPhrase > 0) return;
    const r = Math.random;
    if (this.musicMode === 'title') {
      const phrases = [[4, 3, 2, 0, 2], [2, 3, 4, 5, 4, 2], [7, 5, 4, 2, 4], [0, 2, 4, 3, 2, 0]];
      const ph = phrases[Math.floor(r() * phrases.length)];
      let t = 0;
      ph.forEach((k, i) => {
        this.pluck(scaleNote(62, k), { t, gain: 0.17, bright: 0.5, dur: 2 });
        t += i === ph.length - 1 ? 0 : [0.36, 0.36, 0.72][Math.floor(r() * 3)];
      });
      this.pluck(scaleNote(50, ph[0] % 5), { t: 0, gain: 0.12, dur: 3, bright: 0.25 });
      this.nextPhrase = t + 2.2 + r() * 1.8;
    } else if (this.musicMode === 'play') {
      // 遊んでいる間は、ときどき琴がぽろん
      const k = Math.floor(r() * 7);
      this.pluck(scaleNote(74, k), { gain: 0.05, bright: 0.45, dur: 2 });
      if (r() < 0.5) this.pluck(scaleNote(74, k + 2), { t: 0.36, gain: 0.04, bright: 0.45, dur: 2 });
      this.nextPhrase = 6 + r() * 8;
    } else if (this.musicMode === 'results') {
      const ph = [0, 2, 4, 5, 4, 2, 4, 7, 5, 4, 2, 0];
      ph.forEach((k, i) => this.pluck(scaleNote(64, k), { t: i * 0.24, gain: 0.18, bright: 0.6 }));
      [0, 0.96, 1.92].forEach((t) => this.taiko(t, 0.2, 80, this.musicIn));
      this.nextPhrase = 5;
    }
  }
}

export const audio = new AudioEngine();
