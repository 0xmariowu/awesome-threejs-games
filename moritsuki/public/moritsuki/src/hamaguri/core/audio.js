// ハマグリ突きの音（銛一本の音のしくみを元に、別のものとして作り直した）
// ・効果音は WebAudio で合成。波・蝉・トンビ・風は町の音素材（assets/sfx/town）を借りる（無ければ合成で代わり）
// ・当たりの音は棒を伝わって手に来る音なので、水でこもらせない（feel の系統）
// ・音楽はヨナ抜き音階（ド レ ミ ソ ラ）の琴・木琴のような音

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
    // 水をかぶるとこもる（環境音・効果音）
    this.dunk = ctx.createBiquadFilter();
    this.dunk.type = 'lowpass';
    this.dunk.frequency.value = 20000;
    this.dunk.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.dunk);
    this.feel = ctx.createGain(); this.feel.gain.value = this.vol.sfx; this.feel.connect(this.master);
    this.ui = ctx.createGain(); this.ui.gain.value = this.vol.sfx; this.ui.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0; this.amb.connect(this.dunk);
    // 当たりの音には短い残響（棒の中の響き）
    this.ring = ctx.createDelay(0.1); this.ring.delayTime.value = 0.011;
    const rfb = ctx.createGain(); rfb.gain.value = 0.35;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'bandpass'; rlp.frequency.value = 2600; rlp.Q.value = 1.2;
    this.ring.connect(rlp).connect(rfb).connect(this.ring);
    rfb.connect(this.feel);
    // 音楽
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    const wet = ctx.createGain(); wet.gain.value = 0.4;
    this.delay.connect(wet).connect(this.music);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.music); this.musicIn.connect(this.delay);

    this.white = this.makeNoise('white', 2.5);
    this.brown = this.makeNoise('brown', 4);
    this.buildAmbience();
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
    // 合成の波（素材が読めない時の代わり＋足もとの水のさざめき）
    this.surf = ctx.createGain(); this.surf.gain.value = 0.35; this.surf.connect(this.amb);
    const wave = this.src(this.white, true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.5;
    this.surfSynth = ctx.createGain(); this.surfSynth.gain.value = 0.12;
    wave.connect(bp).connect(this.surfSynth).connect(this.surf);
    wave.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 0.08;
    lfo.connect(lg).connect(this.surfSynth.gain); lfo.start();
    // 足もとの水（ちゃぷちゃぷ）: 波の山が来ると強く
    const lap = this.src(this.white, true);
    const lbp = ctx.createBiquadFilter(); lbp.type = 'bandpass'; lbp.frequency.value = 900; lbp.Q.value = 1.1;
    this.lapG = ctx.createGain(); this.lapG.gain.value = 0;
    lap.connect(lbp).connect(this.lapG).connect(this.amb);
    lap.start(0, 0.7);
    this.lapBp = lbp;
    // 風
    const wind = this.src(this.brown, true);
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 420;
    const wg = ctx.createGain(); wg.gain.value = 0.08;
    wind.connect(wl).connect(wg).connect(this.amb);
    wind.start(0, 1.5);
  }

  async loadSamples() {
    const want = { waves: 'waves.mp3', cicada: 'cicada-bed.mp3', minmin: 'minmin.mp3', tonbi: 'tonbi.mp3', wind: 'wind-soft.mp3' };
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
    if (this.samples.waves) { loop(this.samples.waves, 0.55, this.surf); this.surfSynth.gain.value = 0.04; }
    // 蝉は松林から（遠いので少しこもらせる）
    if (this.samples.cicada) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      this.cicadaG = ctx.createGain(); this.cicadaG.gain.value = 0.13;
      lp.connect(this.cicadaG).connect(this.amb);
      loop(this.samples.cicada, 1, lp, 3);
    }
    if (this.samples.wind) loop(this.samples.wind, 0.18, this.amb, 5);
  }

  /** mode: 'beach' | 'title' | 'results' | 'off' */
  setAmbience(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = mode === 'off' ? 0 : mode === 'title' ? 0.75 : mode === 'results' ? 0.6 : 1;
    this.amb.gain.setTargetAtTime(v * this.vol.amb, t, 0.4);
  }
  /** 顔が水につかった量（0..1）: こもる */
  setDunk(k) {
    if (!this.ctx) return;
    this.dunk.frequency.setTargetAtTime(k > 0.5 ? 700 : 20000, this.ctx.currentTime, 0.04);
  }
  /** 足もとの水（波の山の強さ 0..1） */
  setLap(k) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lapG.gain.setTargetAtTime(0.02 + k * 0.1, t, 0.15);
    this.lapBp.frequency.setTargetAtTime(700 + k * 600, t, 0.2);
  }
  tonbi() {
    if (!this.ctx || !this.samples.tonbi) return;
    const s = this.src(this.samples.tonbi);
    const g = this.ctx.createGain(); g.gain.value = 0.22;
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8;
    s.connect(g).connect(p).connect(this.amb);
    s.start();
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
  tone({ dest = this.sfx, t = 0, type = 'sine', f = 440, f2 = null, dur = 0.2, gain = 0.2, a = 0.003 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, a, gain, dur);
    o.connect(g).connect(dest);
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
  // 木琴のような音（倍音の少ない、すぐ消える音）
  mallet(m, { t = 0, gain = 0.2, dest = null } = {}) {
    const f = midi(m);
    this.tone({ dest: dest || this.musicIn, t, f, dur: 0.5, gain, a: 0.002 });
    this.tone({ dest: dest || this.musicIn, t, f: f * 3.98, dur: 0.08, gain: gain * 0.25, a: 0.001 });
  }
  taiko(t = 0, gain = 0.7, f = 72, dest = null) {
    this.tone({ dest: dest || this.ui, t, f: f * 1.6, f2: f, dur: 0.45, gain, a: 0.002 });
    this.noiseBurst({ dest: dest || this.ui, t, dur: 0.12, type: 'lowpass', f: 900, gain: gain * 0.5 });
  }

  // ───── 突く ─────
  /** 突き下ろす: 柄が水を切る音 */
  plunge() {
    this.noiseBurst({ dur: 0.09, type: 'bandpass', f: 1400, f2: 700, Q: 0.9, gain: 0.05, a: 0.02 });
  }
  /** 砂に刺さる: ザクッ（深さ・砂の締まりで少し変わる） */
  sand(k = 1) {
    const p = (Math.random() - 0.5) * 0.3;
    this.noiseBurst({ dur: 0.07, type: 'bandpass', f: 1900 + Math.random() * 500, f2: 600, Q: 0.8, gain: 0.16 * k, a: 0.002, pan: p });
    this.noiseBurst({ dur: 0.1, type: 'lowpass', f: 380, gain: 0.12 * k, a: 0.003, buf: this.brown });
    // 砂粒がこすれるザラザラ
    for (let i = 0; i < 4; i++) this.noiseBurst({ t: 0.004 + i * 0.011, dur: 0.012, type: 'highpass', f: 3000 + Math.random() * 2500, gain: 0.03 * k, a: 0.001, pan: p });
    this.tone({ f: 120, f2: 70, dur: 0.06, gain: 0.08 * k });
  }
  /**
   * 当たり: 棒を伝わって手に来る音。kind は species.js の sound、size = 大きさの目安（1 = ふつう）
   */
  contact(kind, size = 1) {
    if (!this.ctx) return;
    const F = this.feel;
    const sz = Math.pow(1 / Math.max(size, 0.3), 0.35);
    const click = (g = 0.2, f = 5000) => this.noiseBurst({ dest: F, dur: 0.008, type: 'highpass', f, gain: g, a: 0.0005 });
    const ping = (f, dur, g, t = 0) => {
      this.tone({ dest: F, t, f, dur, gain: g, a: 0.0008 });
      this.tone({ dest: this.ring, t, f, dur: dur * 0.6, gain: g * 0.4, a: 0.0008 });
    };
    switch (kind) {
      case 'kachin': // 本ハマグリ: 澄んだ、詰まった音
        click(0.26);
        ping(2350 * sz, 0.085, 0.3); ping(3720 * sz, 0.06, 0.16); ping(5480 * sz, 0.03, 0.06);
        this.tone({ dest: F, f: 520 * sz, f2: 380 * sz, dur: 0.05, gain: 0.2 });
        break;
      case 'katsun': // チョウセンハマグリ: 厚い殻の重い音
        click(0.24, 4200);
        ping(1900 * sz, 0.075, 0.3); ping(2960 * sz, 0.055, 0.16);
        this.tone({ dest: F, f: 400 * sz, f2: 260 * sz, dur: 0.07, gain: 0.3 });
        this.noiseBurst({ dest: F, dur: 0.04, type: 'lowpass', f: 900, gain: 0.12 });
        break;
      case 'kashi': // バカガイ: うすくて軽い
        click(0.22, 6000);
        ping(3100 * sz, 0.04, 0.2); ping(4700 * sz, 0.025, 0.1);
        this.noiseBurst({ dest: F, t: 0.012, dur: 0.02, type: 'bandpass', f: 3500, Q: 2, gain: 0.08 });
        break;
      case 'chi': // ナガラミ: 小さな高い音
        click(0.15, 7000);
        ping(4300 * sz, 0.025, 0.16);
        break;
      case 'kochin': // ツメタガイ: 丸い殻のこもった音
        click(0.2, 3800);
        ping(1550 * sz, 0.07, 0.25); ping(2640 * sz, 0.05, 0.12);
        this.tone({ dest: F, f: 330, f2: 220, dur: 0.06, gain: 0.2 });
        break;
      case 'gon': // 主: 低く長く響く
        click(0.3, 3000);
        ping(430, 0.55, 0.42); ping(705, 0.4, 0.26); ping(1130, 0.3, 0.14); ping(1880, 0.18, 0.08);
        this.tone({ dest: F, f: 95, f2: 60, dur: 0.4, gain: 0.55 });
        this.noiseBurst({ dest: F, dur: 0.3, type: 'lowpass', f: 400, gain: 0.25, buf: this.brown });
        break;
      case 'chari': // 空き殻: 軽く、カラカラと二、三度はねる
        for (let i = 0; i < 3; i++) {
          click(0.14 - i * 0.03, 5500);
          this.tone({ dest: F, t: i * 0.024, f: 3900 + Math.random() * 1400, dur: 0.018, gain: 0.13 - i * 0.03, a: 0.0005 });
        }
        break;
      case 'gotsu': // 石: 鈍い
        this.tone({ dest: F, f: 170, f2: 90, dur: 0.08, gain: 0.45 });
        this.noiseBurst({ dest: F, dur: 0.06, type: 'lowpass', f: 1000, gain: 0.3, a: 0.001 });
        this.noiseBurst({ dest: F, t: 0.01, dur: 0.05, type: 'bandpass', f: 2200, Q: 1.5, gain: 0.08 });
        break;
      case 'kotsu': // 流木: うつろな木の音
        this.noiseBurst({ dest: F, dur: 0.07, type: 'bandpass', f: 720, Q: 3, gain: 0.35, a: 0.001 });
        this.tone({ dest: F, type: 'triangle', f: 480, f2: 400, dur: 0.06, gain: 0.25 });
        break;
    }
  }

  // ───── 掘る・取る ─────
  scrape(k = 1) {
    this.noiseBurst({ dur: 0.18, type: 'bandpass', f: 700 + Math.random() * 300, f2: 300, Q: 0.7, gain: 0.12 * k, a: 0.03, buf: this.brown });
    this.noiseBurst({ dur: 0.1, type: 'lowpass', f: 1500, gain: 0.05 * k, a: 0.02 });
  }
  touchShell() {
    this.tone({ dest: this.feel, f: 1600, dur: 0.05, gain: 0.08 });
    this.noiseBurst({ dest: this.feel, dur: 0.03, type: 'highpass', f: 3000, gain: 0.05 });
  }
  splash(big = 1) {
    this.noiseBurst({ dur: 0.45 * big, type: 'highpass', f: 1100, gain: 0.22 * big, a: 0.008 });
    this.noiseBurst({ dur: 0.3, type: 'lowpass', f: 700, gain: 0.18 * big });
    for (let i = 0; i < 5; i++) this.drip(0.08 + i * 0.07 + Math.random() * 0.05, 0.5);
  }
  drip(t = 0, k = 1) {
    const f = 900 + Math.random() * 1400;
    this.tone({ t, f, f2: f * 1.9, dur: 0.05, gain: 0.05 * k });
  }
  bag() {
    this.tone({ dest: this.ui, f: 1350, dur: 0.05, gain: 0.08 });
    this.tone({ dest: this.ui, t: 0.04, f: 2100, dur: 0.05, gain: 0.06 });
    this.noiseBurst({ dest: this.ui, dur: 0.12, type: 'bandpass', f: 600, gain: 0.08 });
  }
  wave(k = 1) {
    this.noiseBurst({ dur: 1.4 * k, type: 'bandpass', f: 800, f2: 300, Q: 0.5, gain: 0.18 * k, a: 0.25, buf: this.brown });
    this.noiseBurst({ t: 0.1, dur: 1.1 * k, type: 'highpass', f: 2500, gain: 0.06 * k, a: 0.3 });
  }
  gasp() {
    this.noiseBurst({ dest: this.ui, dur: 0.3, type: 'bandpass', f: 1500, f2: 900, Q: 1.2, gain: 0.2, a: 0.03 });
    this.noiseBurst({ dest: this.ui, t: 0.4, dur: 0.7, type: 'bandpass', f: 900, f2: 500, Q: 0.9, gain: 0.1, a: 0.08 });
  }
  heavy() { this.tone({ dest: this.feel, f: 70, f2: 40, dur: 0.3, gain: 0.45 }); this.noiseBurst({ dest: this.feel, dur: 0.2, type: 'lowpass', f: 300, gain: 0.2, buf: this.brown }); }

  // ───── UI・ジングル ─────
  pickup(rarity = 1) {
    const seq = rarity >= 3 ? [0, 2, 4, 5, 7] : rarity === 2 ? [0, 2, 4, 5] : [0, 2, 4];
    seq.forEach((k, i) => this.pluck(scaleNote(67, k), { dest: this.ui, t: i * 0.08, gain: 0.26, bright: 0.72 }));
  }
  miss() {
    this.pluck(scaleNote(62, 2), { dest: this.ui, gain: 0.2, bright: 0.4 });
    this.pluck(scaleNote(62, 0), { dest: this.ui, t: 0.16, gain: 0.2, bright: 0.35 });
  }
  celebrate() {
    this.taiko(0, 0.8, 70); this.taiko(0.3, 0.8, 70); this.taiko(0.58, 0.6, 80); this.taiko(0.74, 0.9, 64);
    [0, 1, 2, 4, 3, 4, 5, 7].forEach((k, i) => this.pluck(scaleNote(64, k), { dest: this.ui, t: 0.9 + i * 0.1, gain: 0.32, bright: 0.75 }));
    this.pluck(scaleNote(52, 0), { dest: this.ui, t: 0.9, gain: 0.3, dur: 2.5 });
    this.pluck(scaleNote(64, 10), { dest: this.ui, t: 1.75, gain: 0.3, dur: 2.5 });
  }
  legend() {
    this.taiko(0, 0.9, 52); this.taiko(0.2, 0.7, 58); this.taiko(0.55, 1, 48);
    [0, 2, 4, 5, 7, 9, 10].forEach((k, i) => this.pluck(scaleNote(60, k), { dest: this.ui, t: 0.8 + i * 0.09, gain: 0.3, bright: 0.8 }));
  }
  uiHover() { this.tone({ dest: this.ui, f: 1900, dur: 0.03, gain: 0.025 }); }
  uiClick() { this.pluck(scaleNote(72, 0), { dest: this.ui, gain: 0.2, dur: 0.6 }); }
  stamp() { this.tone({ dest: this.ui, f: 120, f2: 50, dur: 0.2, gain: 0.6 }); this.noiseBurst({ dest: this.ui, dur: 0.1, type: 'lowpass', f: 1800, gain: 0.3 }); }
  coin() { this.tone({ dest: this.ui, f: 1800, dur: 0.06, gain: 0.07 }); this.tone({ dest: this.ui, t: 0.05, f: 2700, dur: 0.12, gain: 0.06 }); }
  tick() { this.tone({ dest: this.ui, f: 2400, dur: 0.02, gain: 0.05 }); }
  bell() { [0, 0.6].forEach((t) => { this.tone({ dest: this.ui, t, f: 1320, dur: 1.2, gain: 0.12 }); this.tone({ dest: this.ui, t, f: 2640 * 1.01, dur: 0.6, gain: 0.04 }); }); }

  // ───── 音楽 ─────
  setMusic(mode) { this.musicMode = mode; this.nextPhrase = 0; }
  updateMusic(dt) {
    if (!this.ctx || this.musicMode === 'none') return;
    this.nextPhrase -= dt;
    if (this.nextPhrase > 0) return;
    const r = Math.random;
    if (this.musicMode === 'title') {
      const phrases = [[4, 3, 2, 3, 4, 4, 4], [3, 3, 3, 4, 5, 4], [7, 6, 5, 4, 3, 2], [2, 3, 4, 5, 4, 3, 2, 0]];
      const ph = phrases[Math.floor(r() * phrases.length)];
      let t = 0;
      ph.forEach((k, i) => {
        this.pluck(scaleNote(64, k), { t, gain: 0.2, bright: 0.62 });
        t += i === ph.length - 1 ? 0 : [0.28, 0.28, 0.56][Math.floor(r() * 3)];
      });
      this.pluck(scaleNote(52, ph[0] % 5), { t: 0, gain: 0.14, dur: 2.5, bright: 0.3 });
      this.nextPhrase = t + 1.8 + r() * 1.5;
    } else if (this.musicMode === 'play') {
      // 遊んでいる間は、ときどき木琴がぽつり
      const k = Math.floor(r() * 8);
      this.mallet(scaleNote(72, k), { gain: 0.045 });
      if (r() < 0.5) this.mallet(scaleNote(72, k + 2), { t: 0.25, gain: 0.035 });
      this.nextPhrase = 5 + r() * 8;
    } else if (this.musicMode === 'results') {
      const ph = [0, 2, 4, 5, 4, 2, 4, 7, 5, 4, 2, 0];
      ph.forEach((k, i) => this.pluck(scaleNote(64, k), { t: i * 0.22, gain: 0.2, bright: 0.65 }));
      [0, 0.88, 1.76].forEach((t) => this.taiko(t, 0.22, 80, this.musicIn));
      this.nextPhrase = 4.5;
    }
  }
}

export const audio = new AudioEngine();
