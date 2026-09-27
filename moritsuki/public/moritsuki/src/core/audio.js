// すべて WebAudio で合成するサウンドエンジン（音源ファイルなし）
// 音楽は琉球音階 (C E F G B) の三線風プラック (Karplus-Strong)

const RYUKYU = [0, 4, 5, 7, 11];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const scaleNote = (base, idx) => {
  const o = Math.floor(idx / 5), k = ((idx % 5) + 5) % 5;
  return base + o * 12 + RYUKYU[k];
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.85 };
    this.under = false;
    this.ksCache = new Map();
    this.musicMode = 'none';
    this.nextPhrase = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.sr = ctx.sampleRate;
    this.master = ctx.createGain();
    this.master.gain.value = this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    // SFX: 水中ではこもる
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.vol.sfx;
    this.uwFilter = ctx.createBiquadFilter();
    this.uwFilter.type = 'lowpass';
    this.uwFilter.frequency.value = 18000;
    this.uwFilter.Q.value = 0.4;
    this.sfx.connect(this.uwFilter).connect(this.master);
    // こもらない SFX（UI・ジングル）
    this.ui = ctx.createGain();
    this.ui.gain.value = this.vol.sfx;
    this.ui.connect(this.master);

    // 音楽 + ディレイ
    this.music = ctx.createGain();
    this.music.gain.value = this.vol.music;
    this.music.connect(this.master);
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    this.delay.connect(wet).connect(this.music);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.music);
    this.musicIn.connect(this.delay);

    this.white = this.makeNoise('white', 2.5);
    this.brown = this.makeNoise('brown', 4);
    this.crackle = this.makeCrackle(3);
    this.buildAmbience();
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ui.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
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

  // テッポウエビのパチパチ音
  makeCrackle(sec) {
    const n = Math.floor(this.sr * sec);
    const buf = this.ctx.createBuffer(2, n, this.sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const clicks = Math.floor(sec * 55);
      for (let c = 0; c < clicks; c++) {
        const at = Math.floor(Math.random() * (n - 200));
        const amp = Math.pow(Math.random(), 3) * 0.9;
        for (let k = 0; k < 60; k++) d[at + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 8);
      }
    }
    return buf;
  }

  src(buf, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    return s;
  }

  buildAmbience() {
    const ctx = this.ctx;
    // 水中
    this.uwBed = ctx.createGain();
    this.uwBed.gain.value = 0;
    this.uwBed.connect(this.master);
    const rumble = this.src(this.brown, true);
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 260;
    const rg = ctx.createGain(); rg.gain.value = 0.55;
    rumble.connect(rlp).connect(rg).connect(this.uwBed);
    rumble.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.2;
    lfo.connect(lg).connect(rg.gain); lfo.start();
    const cr = this.src(this.crackle, true);
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 2500;
    const cg = ctx.createGain(); cg.gain.value = 0.16;
    cr.connect(chp).connect(cg).connect(this.uwBed);
    cr.start();

    // 水上: 波・風
    this.airBed = ctx.createGain();
    this.airBed.gain.value = 0;
    this.airBed.connect(this.master);
    const wave = this.src(this.white, true);
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 480; wbp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.22;
    wave.connect(wbp).connect(wg).connect(this.airBed);
    wave.start();
    const wl = ctx.createOscillator(); wl.frequency.value = 0.11;
    const wlg = ctx.createGain(); wlg.gain.value = 0.17;
    wl.connect(wlg).connect(wg.gain); wl.start();
    const hiss = this.src(this.white, true);
    const hhp = ctx.createBiquadFilter(); hhp.type = 'highpass'; hhp.frequency.value = 3500;
    const hg = ctx.createGain(); hg.gain.value = 0.03;
    hiss.connect(hhp).connect(hg).connect(this.airBed);
    hiss.start(0, 1.1);
    const wind = this.src(this.brown, true);
    const wdl = ctx.createBiquadFilter(); wdl.type = 'lowpass'; wdl.frequency.value = 500;
    const wdg = ctx.createGain(); wdg.gain.value = 0.12;
    wind.connect(wdl).connect(wdg).connect(this.airBed);
    wind.start(0, 2);
  }

  setAmbience(mode) {
    // mode: 'under' | 'surface' | 'title' | 'off'
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const under = mode === 'under' || mode === 'title';
    this.under = under;
    this.uwBed.gain.setTargetAtTime(mode === 'off' ? 0 : under ? (mode === 'title' ? 0.35 : 0.5) : 0, t, 0.25);
    this.airBed.gain.setTargetAtTime(mode === 'surface' ? 0.6 : 0, t, 0.25);
    this.uwFilter.frequency.setTargetAtTime(under ? 1100 : 18000, t, 0.08);
  }

  // ───────── 基本部品 ─────────
  env(g, t, a, peak, d, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }
  noiseBurst({ dest = this.sfx, t = 0, dur = 0.2, type = 'bandpass', f = 800, f2 = null, Q = 1, gain = 0.3, a = 0.005, buf = this.white }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const s = this.src(buf);
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = Q;
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, a, gain, dur);
    s.connect(flt).connect(g).connect(dest);
    s.start(t0, Math.random() * 1.5, dur + a + 0.05);
  }
  tone({ dest = this.sfx, t = 0, type = 'sine', f = 440, f2 = null, dur = 0.2, gain = 0.2, a = 0.004, curve = 'exp' }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(f2, t0 + dur) : o.frequency.linearRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, a, gain, dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + a + dur + 0.05);
    return o;
  }

  // 三線風プラック
  ks(freq, dur = 1.6, bright = 0.5) {
    const key = `${Math.round(freq)}|${dur}|${bright}`;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const sr = this.sr;
    const n = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const line = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev + (w - prev) * (0.25 + bright * 0.75); line[i] = prev; }
    let idx = 0, last = 0;
    const decay = 0.996 + bright * 0.0025;
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      const nxt = line[(idx + 1) % N];
      const v = (cur + nxt) * 0.5 * decay;
      line[idx] = v;
      d[i] = cur * 0.9 + (cur - last) * 0.25; // 胴鳴りっぽいアタック
      last = cur;
      idx = (idx + 1) % N;
    }
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    this.ksCache.set(key, buf);
    return buf;
  }
  pluck(m, { t = 0, gain = 0.35, dest = null, dur = 1.6, bright = 0.55, bend = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const s = this.src(this.ks(midi(m), dur, bright));
    if (bend) { s.playbackRate.setValueAtTime(Math.pow(2, bend / 12), t0); s.playbackRate.linearRampToValueAtTime(1, t0 + 0.12); }
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(g).connect(dest || this.musicIn);
    s.start(t0);
  }
  taiko(t = 0, gain = 0.7, f = 72, dest = null) {
    this.tone({ dest: dest || this.ui, t, f: f * 1.6, f2: f, dur: 0.45, gain, a: 0.002 });
    this.noiseBurst({ dest: dest || this.ui, t, dur: 0.12, type: 'lowpass', f: 900, gain: gain * 0.5 });
  }

  // ───────── 効果音 ─────────
  kick(power = 1) { this.noiseBurst({ dur: 0.28, type: 'bandpass', f: 420, f2: 220, Q: 0.8, gain: 0.07 * power, a: 0.06 }); }
  bubbles(n = 4, gain = 0.06) {
    for (let i = 0; i < n; i++) {
      const f = 350 + Math.random() * 700;
      this.tone({ t: i * 0.035 + Math.random() * 0.05, f, f2: f * (1.6 + Math.random()), dur: 0.05 + Math.random() * 0.04, gain: gain * (0.6 + Math.random() * 0.6) });
    }
  }
  splash(big = 1) {
    this.noiseBurst({ dur: 0.7 * big, type: 'highpass', f: 900, gain: 0.35 * big, a: 0.01 });
    this.noiseBurst({ dur: 0.4, type: 'lowpass', f: 600, gain: 0.25 * big });
    this.bubbles(6, 0.05);
  }
  gasp() {
    this.noiseBurst({ dest: this.ui, dur: 0.35, type: 'bandpass', f: 1500, f2: 900, Q: 1.2, gain: 0.28, a: 0.04 });
    this.noiseBurst({ dest: this.ui, t: 0.45, dur: 0.9, type: 'bandpass', f: 900, f2: 500, Q: 0.9, gain: 0.16, a: 0.08 });
  }
  breathe(inhale = true) {
    this.noiseBurst({ dest: this.ui, dur: inhale ? 0.7 : 0.9, type: 'bandpass', f: inhale ? 1300 : 800, f2: inhale ? 1700 : 500, Q: 1.4, gain: 0.07, a: 0.25 });
  }
  heartbeat(k = 1) {
    this.tone({ dest: this.ui, f: 62, f2: 40, dur: 0.16, gain: 0.5 * k, a: 0.005 });
    this.tone({ dest: this.ui, t: 0.2, f: 55, f2: 36, dur: 0.14, gain: 0.35 * k, a: 0.005 });
  }

  startCharge() {
    if (!this.ctx || this.chargeNode) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, t + 0.1);
    o.connect(bp).connect(g).connect(this.sfx);
    o.start();
    this.chargeNode = { o, bp, g };
  }
  setCharge(c) {
    if (!this.chargeNode) return;
    const t = this.ctx.currentTime;
    this.chargeNode.o.frequency.setTargetAtTime(60 + c * 90 + Math.random() * 8, t, 0.03);
    this.chargeNode.bp.frequency.setTargetAtTime(700 + c * 1400, t, 0.05);
    this.chargeNode.g.gain.setTargetAtTime(0.02 + c * 0.05 * (c >= 1 ? 0.4 : 1), t, 0.05);
  }
  stopCharge() {
    if (!this.chargeNode) return;
    const { o, g } = this.chargeNode;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.02);
    o.stop(t + 0.15);
    this.chargeNode = null;
  }
  shoot(power = 1) {
    this.noiseBurst({ dur: 0.12, type: 'bandpass', f: 1800, f2: 500, Q: 0.7, gain: 0.3 * (0.5 + power * 0.5) });
    this.tone({ f: 190, f2: 60, dur: 0.16, gain: 0.35 * power });
    this.pluck(40, { dest: this.sfx, gain: 0.25, dur: 0.4, bright: 0.2 });
    this.bubbles(5, 0.04);
  }
  hit() {
    this.tone({ f: 150, f2: 45, dur: 0.24, gain: 0.55 });
    this.noiseBurst({ dur: 0.12, type: 'lowpass', f: 1200, gain: 0.35 });
    this.noiseBurst({ t: 0.02, dur: 0.06, type: 'bandpass', f: 2600, Q: 2, gain: 0.2 });
    for (let i = 0; i < 5; i++) this.noiseBurst({ t: 0.15 + i * 0.09, dur: 0.06, type: 'bandpass', f: 700 + Math.random() * 300, Q: 1.5, gain: 0.12 });
  }
  clink() {
    this.tone({ f: 2400, dur: 0.18, gain: 0.12 });
    this.tone({ f: 3350, dur: 0.12, gain: 0.08 });
    this.noiseBurst({ dur: 0.05, type: 'highpass', f: 3000, gain: 0.15 });
  }
  swoosh() { this.noiseBurst({ dur: 0.25, type: 'bandpass', f: 1200, f2: 350, Q: 1.2, gain: 0.12, a: 0.03 }); }
  flee() { this.noiseBurst({ dur: 0.15, type: 'bandpass', f: 500, f2: 250, Q: 1, gain: 0.08, a: 0.01 }); }
  tug() { this.tone({ f: 90, f2: 50, dur: 0.15, gain: 0.3 }); this.noiseBurst({ dur: 0.1, type: 'lowpass', f: 500, gain: 0.15 }); }
  bite() {
    this.noiseBurst({ dur: 0.18, type: 'bandpass', f: 1400, Q: 0.6, gain: 0.5, a: 0.002 });
    this.tone({ f: 110, f2: 40, dur: 0.3, gain: 0.5, type: 'square' });
  }
  ink() { this.noiseBurst({ dur: 0.6, type: 'lowpass', f: 900, f2: 200, gain: 0.3, a: 0.02 }); this.bubbles(8, 0.05); }
  sandBurst() { this.noiseBurst({ dur: 0.5, type: 'lowpass', f: 700, f2: 150, gain: 0.25, a: 0.01, buf: this.brown }); }
  pickup() {
    this.tone({ dest: this.ui, f: 520, f2: 820, dur: 0.12, gain: 0.18 });
    this.pluck(scaleNote(72, 2), { dest: this.ui, t: 0.08, gain: 0.25 });
    this.pluck(scaleNote(72, 4), { dest: this.ui, t: 0.16, gain: 0.25 });
  }
  catchJingle(rarity = 1) {
    const seq = rarity >= 3 ? [0, 2, 4, 5, 7, 9] : rarity === 2 ? [0, 2, 4, 5] : [0, 2, 4];
    seq.forEach((k, i) => this.pluck(scaleNote(67, k), { dest: this.ui, t: i * 0.085, gain: 0.3, bright: 0.7 }));
  }
  celebrate() {
    this.taiko(0, 0.8, 70); this.taiko(0.32, 0.8, 70); this.taiko(0.62, 0.6, 80); this.taiko(0.78, 0.9, 64);
    const mel = [0, 1, 2, 4, 5, 4, 7, 9];
    mel.forEach((k, i) => this.pluck(scaleNote(64, k), { dest: this.ui, t: 0.95 + i * 0.1, gain: 0.34, bright: 0.75, bend: i === 0 ? -1 : 0 }));
    this.pluck(scaleNote(52, 0), { dest: this.ui, t: 0.95, gain: 0.3, dur: 2.5 });
    this.pluck(scaleNote(64, 10), { dest: this.ui, t: 1.85, gain: 0.3, dur: 2.5 });
    this.noiseBurst({ dest: this.ui, t: 0.95, dur: 1.4, type: 'highpass', f: 5000, gain: 0.05, a: 0.3 });
  }
  horn() {
    // ほら貝
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t0);
    o.frequency.linearRampToValueAtTime(220, t0 + 0.4);
    o.frequency.setValueAtTime(220, t0 + 1.6);
    o.frequency.linearRampToValueAtTime(196, t0 + 2.2);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
    const vg = ctx.createGain(); vg.gain.value = 3;
    vib.connect(vg).connect(o.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.3);
    g.gain.setValueAtTime(0.35, t0 + 1.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    o.connect(f1).connect(f2).connect(g).connect(this.ui);
    o.start(t0); vib.start(t0); o.stop(t0 + 2.5); vib.stop(t0 + 2.5);
  }
  blackout() { this.tone({ dest: this.ui, f: 200, f2: 40, dur: 2.2, gain: 0.3, type: 'triangle' }); }
  uiHover() { this.tone({ dest: this.ui, f: 1900, dur: 0.03, gain: 0.03 }); }
  uiClick() { this.pluck(scaleNote(72, 0), { dest: this.ui, gain: 0.22, dur: 0.6 }); }
  stamp() { this.tone({ dest: this.ui, f: 120, f2: 50, dur: 0.2, gain: 0.6 }); this.noiseBurst({ dest: this.ui, dur: 0.1, type: 'lowpass', f: 1800, gain: 0.3 }); }
  tick() { this.tone({ dest: this.ui, f: 2400, dur: 0.02, gain: 0.05 }); }
  coin() { this.tone({ dest: this.ui, f: 1800, dur: 0.06, gain: 0.07 }); this.tone({ dest: this.ui, t: 0.05, f: 2700, dur: 0.12, gain: 0.06 }); }

  // ───────── 音楽 ─────────
  setMusic(mode) { this.musicMode = mode; this.nextPhrase = 0; }

  updateMusic(dt) {
    if (!this.ctx || this.musicMode === 'none') return;
    this.nextPhrase -= dt;
    if (this.nextPhrase > 0) return;
    const r = Math.random;
    if (this.musicMode === 'title') {
      // ゆったりした三線のフレーズ
      const phrases = [[0, 2, 3, 4, 3, 2], [4, 5, 7, 5, 4, 2, 0], [2, 4, 5, 4, 2, 1, 0], [7, 5, 4, 5, 4, 2]];
      const ph = phrases[Math.floor(r() * phrases.length)];
      let t = 0;
      ph.forEach((k, i) => {
        this.pluck(scaleNote(62, k), { t, gain: 0.22, bright: 0.6, bend: r() < 0.2 ? -1 : 0 });
        t += i === ph.length - 1 ? 0 : [0.3, 0.3, 0.6][Math.floor(r() * 3)];
      });
      this.pluck(scaleNote(50, ph[0] % 5), { t: 0, gain: 0.16, dur: 2.5, bright: 0.3 });
      this.nextPhrase = t + 1.6 + r() * 1.5;
    } else if (this.musicMode === 'under') {
      // 水中: 鈴のような音がまばらに
      const k = Math.floor(r() * 8);
      this.tone({ dest: this.musicIn, f: midi(scaleNote(74, k)), dur: 2.6, gain: 0.05, a: 0.02 });
      this.tone({ dest: this.musicIn, f: midi(scaleNote(74, k)) * 2.01, dur: 1.4, gain: 0.015, a: 0.02 });
      this.nextPhrase = 2.5 + r() * 5;
    } else if (this.musicMode === 'surface') {
      const ph = [[0, 2, 4], [4, 2, 1, 0], [2, 3, 4, 5]][Math.floor(r() * 3)];
      ph.forEach((k, i) => this.pluck(scaleNote(62, k), { t: i * 0.35, gain: 0.14, bright: 0.5 }));
      this.nextPhrase = 6 + r() * 8;
    } else if (this.musicMode === 'results') {
      const ph = [0, 2, 4, 5, 4, 2, 4, 7, 5, 4, 2, 0];
      ph.forEach((k, i) => this.pluck(scaleNote(62, k), { t: i * 0.22, gain: 0.22, bright: 0.65 }));
      [0, 0.88, 1.76].forEach((t) => this.taiko(t, 0.25, 80, this.musicIn));
      this.nextPhrase = 4.5;
    }
  }
}

export const audio = new AudioEngine();
