// ウナギ掬いの音（蛤突きの音のしくみを元に、夜の水路用に別のものとして作り直した）
// ・環境音: 田んぼのカエルの大合唱・水路の流れは町の音素材（assets/sfx/town）を借りる。夜明けにヒグラシとウグイス
//   虫の声・落ち込みの水音・パイプのちょろちょろ・自販機のうなりは WebAudio で合成
// ・暗渠の中では音がこもって響く
// ・効果音（水をこぐ・網を入れる・暴れる・ビク）は合成
// ・音楽は都節（ミ ファ ラ シ ド）の夜の琴と、結果のヨナ抜き

const MIYAKO = [0, 1, 5, 7, 8];
const YONA = [0, 2, 4, 7, 9];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const noteOf = (scale) => (base, idx) => {
  const o = Math.floor(idx / 5), k = ((idx % 5) + 5) % 5;
  return base + o * 12 + scale[k];
};
const yona = noteOf(YONA), miyako = noteOf(MIYAKO);
const SFX_DIR = new URL('../../../assets/sfx/town/', import.meta.url).href;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.45, sfx: 0.9, amb: 0.85 };
    this.ksCache = new Map();
    this.musicMode = 'none';
    this.nextPhrase = 0;
    this.samples = {};
    this.mode = 'off';
    this.dawn = 0;
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
    // 暗渠の響き（合成した残響）
    this.room = ctx.createGain(); this.room.gain.value = 1; this.room.connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeIR(1.6);
    this.verbG = ctx.createGain(); this.verbG.gain.value = 0;
    this.verb.connect(this.verbG).connect(this.master);
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    this.muffle.connect(this.room);
    this.muffle.connect(this.verb);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.muffle);
    this.ui = ctx.createGain(); this.ui.gain.value = this.vol.sfx; this.ui.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0; this.amb.connect(this.muffle);
    this.far = ctx.createGain(); this.far.gain.value = 1; this.far.connect(this.amb);   // 田んぼの音（暗渠の中では遠く）
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
    this.pink = this.makeNoise('pink', 3);
    this.buildAmbience();
    this.loadSamples();
  }

  makeIR(sec) {
    const n = Math.floor(this.sr * sec);
    const buf = this.ctx.createBuffer(2, n, this.sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / this.sr;
        // コンクリートの箱: 早い反射がいくつかと、長めの尾
        const early = (i % Math.floor(this.sr * 0.0137) < 3 ? 0.6 : 0) * Math.exp(-t * 18);
        d[i] = ((Math.random() * 2 - 1) * 0.5 + early) * Math.exp(-t * 3.2);
      }
    }
    return buf;
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music, t, 0.05);
    for (const b of [this.sfx, this.ui]) b.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.setAmbience(this.mode);
  }

  makeNoise(kind, sec) {
    const n = Math.floor(this.sr * sec);
    const buf = this.ctx.createBuffer(1, n, this.sr);
    const d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 3; }
      else d[i] = w;
    }
    return buf;
  }
  src(buf, loop = false) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }

  // ───── 環境音 ─────
  buildAmbience() {
    const ctx = this.ctx;
    // 足もとの水の流れ（合成）: 静かなさらさら
    const flow = this.src(this.pink, true);
    const fbp = ctx.createBiquadFilter(); fbp.type = 'bandpass'; fbp.frequency.value = 1400; fbp.Q.value = 0.6;
    this.flowG = ctx.createGain(); this.flowG.gain.value = 0.05;
    flow.connect(fbp).connect(this.flowG).connect(this.amb);
    flow.start();
    // 落ち込みの水音（近いほど大きい）
    const fall = this.src(this.white, true);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 2200;
    const fhp = ctx.createBiquadFilter(); fhp.type = 'highpass'; fhp.frequency.value = 180;
    this.fallG = ctx.createGain(); this.fallG.gain.value = 0;
    fall.connect(fhp).connect(flp).connect(this.fallG).connect(this.amb);
    fall.start(0, 0.5);
    const fall2 = this.src(this.brown, true);
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 400;
    this.fallLowG = ctx.createGain(); this.fallLowG.gain.value = 0;
    fall2.connect(f2).connect(this.fallLowG).connect(this.amb);
    fall2.start(0, 1.1);
    // パイプのちょろちょろ（高めのさらさら＋しずく）
    const tr = this.src(this.white, true);
    const tbp = ctx.createBiquadFilter(); tbp.type = 'bandpass'; tbp.frequency.value = 3200; tbp.Q.value = 1.4;
    this.trickleG = ctx.createGain(); this.trickleG.gain.value = 0;
    tr.connect(tbp).connect(this.trickleG).connect(this.amb);
    tr.start(0, 0.2);
    this.trickleK = 0;
    // 自販機のうなり
    this.humG = ctx.createGain(); this.humG.gain.value = 0;
    this.humG.connect(this.amb);
    for (const [f, g] of [[98, 0.35], [196, 0.2], [294, 0.07], [1180, 0.012]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(this.humG); o.start();
    }
    // 虫（夏の夜: 草むらのジーという連続音と、ときどきのリーリー）
    this.insectG = ctx.createGain(); this.insectG.gain.value = 0.5;
    this.insectG.connect(this.far);
    const bed = this.src(this.white, true);
    const ib = ctx.createBiquadFilter(); ib.type = 'bandpass'; ib.frequency.value = 5200; ib.Q.value = 8;
    const ibg = ctx.createGain(); ibg.gain.value = 0.02;
    bed.connect(ib).connect(ibg).connect(this.insectG);
    bed.start(0, 0.9);
    // ケラの「ジー」: 振幅を細かくふるわせた低めの音
    const kera = ctx.createOscillator(); kera.frequency.value = 3400;
    const kAm = ctx.createGain(); kAm.gain.value = 0;
    const kLfo = ctx.createOscillator(); kLfo.frequency.value = 55;
    const kLg = ctx.createGain(); kLg.gain.value = 0.012;
    kLfo.connect(kLg).connect(kAm.gain);
    const kp = ctx.createStereoPanner(); kp.pan.value = 0.6;
    kera.connect(kAm).connect(kp).connect(this.insectG);
    kera.start(); kLfo.start();
    this.nextCricket = 2;
  }

  async loadSamples() {
    const want = { frogs: 'frogs.mp3', creek: 'creek.mp3', higurashi: 'higurashi.mp3', uguisu: 'uguisu.mp3', wind: 'wind-soft.mp3' };
    await Promise.all(Object.entries(want).map(async ([k, f]) => {
      try {
        const r = await fetch(SFX_DIR + f);
        if (!r.ok) return;
        this.samples[k] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* 無くても合成で鳴らす */ }
    }));
    const ctx = this.ctx;
    const loop = (buf, gain, dest, off = 0) => {
      const s = this.src(buf, true);
      const g = ctx.createGain(); g.gain.value = gain;
      s.connect(g).connect(dest);
      s.start(0, off);
      return g;
    };
    // カエルの大合唱（左右の田んぼから。2 つずらして広げる）
    if (this.samples.frogs) {
      this.frogG = ctx.createGain(); this.frogG.gain.value = 0.55;
      this.frogG.connect(this.far);
      for (const [pan, off, g] of [[-0.55, 0, 0.7], [0.6, 17.3, 0.6]]) {
        const p = ctx.createStereoPanner(); p.pan.value = pan;
        p.connect(this.frogG);
        loop(this.samples.frogs, g, p, off);
      }
    }
    if (this.samples.creek) { this.creekG = loop(this.samples.creek, 0.12, this.amb, 4); }
    if (this.samples.wind) loop(this.samples.wind, 0.05, this.far, 5);
  }

  /** mode: 'night' | 'title' | 'results' | 'off' */
  setAmbience(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = mode === 'off' ? 0 : mode === 'title' ? 0.8 : mode === 'results' ? 0.55 : 1;
    this.amb.gain.setTargetAtTime(v * this.vol.amb, t, 0.4);
  }
  /**
   * 場所の音: fall = 落ち込みの近さ, trickle = パイプの近さ, hum = 自販機の近さ, culvert = 暗渠の中, frogsK = カエル（近づくと鳴きやむ）
   */
  setPlace({ fall = 0, trickle = 0, hum = 0, culvert = 0, frogsK = 1, dawn = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fallG.gain.setTargetAtTime(fall * 0.09, t, 0.3);
    this.fallLowG.gain.setTargetAtTime(fall * 0.2, t, 0.3);
    this.trickleK = trickle;
    this.trickleG.gain.setTargetAtTime(trickle * 0.035, t, 0.3);
    this.humG.gain.setTargetAtTime(hum * 0.02, t, 0.5);
    this.verbG.gain.setTargetAtTime(culvert * 0.55, t, 0.25);
    this.far.gain.setTargetAtTime(1 - culvert * 0.8, t, 0.3);
    this.muffle.frequency.setTargetAtTime(culvert > 0.5 ? 5200 : 20000, t, 0.3);
    // 夜明け: カエルと虫が静かになる
    this.dawn = dawn;
    if (this.frogG) this.frogG.gain.setTargetAtTime(0.55 * frogsK * (1 - dawn * 0.75), t, 0.8);
    this.insectG.gain.setTargetAtTime(0.5 * (1 - dawn * 0.8), t, 0.8);
    if (this.creekG) this.creekG.gain.setTargetAtTime(0.1 + fall * 0.08, t, 0.4);
  }
  /** 水の中を歩く・網を引く流れの音の強さ */
  setWade(k) {
    if (!this.ctx) return;
    this.flowG.gain.setTargetAtTime(0.04 + k * 0.12, this.ctx.currentTime, 0.1);
  }
  updateAmbience(dt) {
    if (!this.ctx || this.mode === 'off') return;
    // リーリー（コオロギ）とパイプのしずく
    this.nextCricket -= dt;
    if (this.nextCricket <= 0) {
      this.nextCricket = 0.8 + Math.random() * 3;
      if (this.dawn < 0.7) this.cricket();
    }
    if (this.trickleK > 0.05 && Math.random() < dt * 8 * this.trickleK) this.drip(0, 0.35 * this.trickleK);
    // 夜明けの鳥・ヒグラシ
    this.nextBird = (this.nextBird ?? 6) - dt;
    if (this.nextBird <= 0) {
      this.nextBird = 7 + Math.random() * 10;
      if (this.dawn > 0.55 && this.samples.higurashi && Math.random() < 0.6) this.playSample('higurashi', 0.22 * this.dawn, Math.random() * 1.2 - 0.6);
      else if (this.dawn > 0.7 && this.samples.uguisu) this.playSample('uguisu', 0.12, Math.random() * 1.2 - 0.6);
    }
  }
  playSample(k, gain, pan = 0) {
    if (!this.ctx || !this.samples[k]) return;
    const s = this.src(this.samples[k]);
    const g = this.ctx.createGain(); g.gain.value = gain;
    const p = this.ctx.createStereoPanner(); p.pan.value = pan;
    s.connect(g).connect(p).connect(this.far);
    s.start();
  }
  cricket() {
    const f = 3800 + Math.random() * 900;
    const pan = Math.random() * 1.6 - 0.8;
    const n = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const t0 = i * 0.11;
      for (let k = 0; k < 4; k++) this.tone({ dest: this.insectG, t: t0 + k * 0.016, f, dur: 0.012, gain: 0.012, a: 0.002, pan });
    }
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

  // ───── 水 ─────
  /** 水の中の一歩（じゃぶ） */
  wade(k = 1) {
    const p = (Math.random() - 0.5) * 0.4;
    this.noiseBurst({ dur: 0.28, type: 'bandpass', f: 700 + Math.random() * 300, f2: 300, Q: 0.8, gain: 0.07 * k, a: 0.04, buf: this.pink, pan: p });
    this.noiseBurst({ t: 0.05, dur: 0.18, type: 'bandpass', f: 1800, f2: 900, Q: 1.2, gain: 0.03 * k, a: 0.02, pan: p });
    for (let i = 0; i < 3; i++) this.bloop(0.08 + i * 0.05 + Math.random() * 0.05, 0.25 * k);
  }
  /** 小さな泡のはじける音 */
  bloop(t = 0, k = 1) {
    const f = 500 + Math.random() * 900;
    this.tone({ t, f, f2: f * 1.8, dur: 0.035, gain: 0.04 * k });
  }
  /** 網が水に入る */
  netIn(k = 1) {
    this.noiseBurst({ dur: 0.18 + k * 0.2, type: 'bandpass', f: 1300, f2: 500, Q: 0.7, gain: 0.12 * k, a: 0.005 });
    this.noiseBurst({ dur: 0.25, type: 'lowpass', f: 600, gain: 0.08 * k, buf: this.brown });
    for (let i = 0; i < 4; i++) this.bloop(0.05 + i * 0.04, 0.6 * k);
  }
  /** 網を上げる（網から水がざーっと落ちる） */
  netOut(k = 1) {
    this.noiseBurst({ dur: 0.7, type: 'highpass', f: 1800, gain: 0.08 * k, a: 0.03 });
    this.noiseBurst({ dur: 0.5, type: 'bandpass', f: 900, f2: 500, Q: 0.6, gain: 0.08 * k, a: 0.01, buf: this.pink });
    for (let i = 0; i < 10; i++) this.drip(0.25 + i * 0.07 + Math.random() * 0.06, 0.8 * k);
  }
  drip(t = 0, k = 1) {
    const f = 900 + Math.random() * 1400;
    this.tone({ t, f, f2: f * 1.9, dur: 0.05, gain: 0.05 * k });
  }
  /** 網の中で暴れる（ばちゃばちゃ） */
  thrash(k = 1) {
    this.noiseBurst({ dur: 0.09, type: 'bandpass', f: 1500 + Math.random() * 800, Q: 0.9, gain: 0.12 * k, a: 0.002, pan: (Math.random() - 0.5) * 0.3 });
    this.noiseBurst({ t: 0.02, dur: 0.07, type: 'lowpass', f: 700, gain: 0.07 * k, buf: this.brown });
    if (Math.random() < 0.5) this.drip(0.05, 0.6);
  }
  /** 水面で跳ねる（逃げた・カエル） */
  splash(k = 1) {
    this.noiseBurst({ dur: 0.35 * k + 0.1, type: 'highpass', f: 1000, gain: 0.16 * k, a: 0.006 });
    this.noiseBurst({ dur: 0.22, type: 'lowpass', f: 700, gain: 0.12 * k });
    for (let i = 0; i < 4; i++) this.drip(0.06 + i * 0.07 + Math.random() * 0.05, 0.4);
  }
  /** カエルが水に跳びこむ（ぽちゃん） */
  plop(k = 1) {
    this.tone({ f: 620, f2: 190, dur: 0.09, gain: 0.14 * k });
    this.noiseBurst({ dur: 0.08, type: 'bandpass', f: 900, Q: 2, gain: 0.08 * k });
    this.tone({ t: 0.06, f: 900, f2: 1600, dur: 0.05, gain: 0.05 * k });
  }
  /** エビがはねる（ぴしっ） */
  flick() { this.noiseBurst({ dur: 0.025, type: 'highpass', f: 4000, gain: 0.05, a: 0.001 }); }
  /** ビクに入れる: 竹かごのきしみ・ふた */
  biku(eel = false) {
    this.noiseBurst({ dest: this.ui, dur: 0.12, type: 'bandpass', f: 520, Q: 3, gain: 0.12 });
    this.tone({ dest: this.ui, type: 'triangle', f: 330, f2: 280, dur: 0.07, gain: 0.08 });
    this.noiseBurst({ dest: this.ui, t: 0.12, dur: 0.05, type: 'bandpass', f: 1400, Q: 2, gain: 0.06 });
    if (eel) for (let i = 0; i < 3; i++) this.noiseBurst({ t: 0.2 + i * 0.09, dur: 0.06, type: 'bandpass', f: 1200, Q: 1, gain: 0.04 });
  }
  /** 逃がす（そっと水へ） */
  release() {
    this.noiseBurst({ dur: 0.3, type: 'bandpass', f: 900, f2: 500, Q: 0.7, gain: 0.07 });
    for (let i = 0; i < 3; i++) this.bloop(0.08 + i * 0.06, 0.5);
  }
  /** 落ち込みをよじ登る（長靴がコンクリートをこする） */
  climb() {
    this.noiseBurst({ dur: 0.25, type: 'bandpass', f: 600, f2: 900, Q: 1.4, gain: 0.08, a: 0.02 });
    this.noiseBurst({ t: 0.3, dur: 0.6, type: 'highpass', f: 1500, gain: 0.07, a: 0.05 });
    for (let i = 0; i < 6; i++) this.drip(0.5 + i * 0.08, 0.5);
  }
  heavy() { this.tone({ dest: this.ui, f: 70, f2: 40, dur: 0.3, gain: 0.4 }); this.noiseBurst({ dest: this.ui, dur: 0.2, type: 'lowpass', f: 300, gain: 0.2, buf: this.brown }); }

  // ───── UI・ジングル ─────
  pickup(rarity = 1) {
    const seq = rarity >= 3 ? [0, 2, 4, 5, 7] : rarity === 2 ? [0, 2, 4, 5] : [0, 2, 4];
    seq.forEach((k, i) => this.pluck(yona(67, k), { dest: this.ui, t: i * 0.08, gain: 0.24, bright: 0.72 }));
  }
  miss() {
    this.pluck(miyako(62, 2), { dest: this.ui, gain: 0.2, bright: 0.4 });
    this.pluck(miyako(62, 0), { dest: this.ui, t: 0.16, gain: 0.2, bright: 0.35 });
  }
  gentle() {
    [4, 2, 0].forEach((k, i) => this.pluck(yona(72, k), { dest: this.ui, t: i * 0.12, gain: 0.16, bright: 0.5 }));
  }
  celebrate() {
    this.taiko(0, 0.8, 70); this.taiko(0.3, 0.8, 70); this.taiko(0.58, 0.6, 80); this.taiko(0.74, 0.9, 64);
    [0, 1, 2, 4, 3, 4, 5, 7].forEach((k, i) => this.pluck(yona(64, k), { dest: this.ui, t: 0.9 + i * 0.1, gain: 0.3, bright: 0.75 }));
    this.pluck(yona(52, 0), { dest: this.ui, t: 0.9, gain: 0.28, dur: 2.5 });
    this.pluck(yona(64, 10), { dest: this.ui, t: 1.75, gain: 0.28, dur: 2.5 });
  }
  legend() {
    this.taiko(0, 0.9, 52); this.taiko(0.2, 0.7, 58); this.taiko(0.55, 1, 48);
    [0, 2, 4, 5, 7, 9, 10].forEach((k, i) => this.pluck(miyako(60, k), { dest: this.ui, t: 0.8 + i * 0.09, gain: 0.3, bright: 0.8 }));
  }
  uiHover() { this.tone({ dest: this.ui, f: 1900, dur: 0.03, gain: 0.025 }); }
  uiClick() { this.pluck(yona(72, 0), { dest: this.ui, gain: 0.2, dur: 0.6 }); }
  stamp() { this.tone({ dest: this.ui, f: 120, f2: 50, dur: 0.2, gain: 0.6 }); this.noiseBurst({ dest: this.ui, dur: 0.1, type: 'lowpass', f: 1800, gain: 0.3 }); }
  coin() { this.tone({ dest: this.ui, f: 1800, dur: 0.06, gain: 0.07 }); this.tone({ dest: this.ui, t: 0.05, f: 2700, dur: 0.12, gain: 0.06 }); }
  bell() { [0, 0.6].forEach((t) => { this.tone({ dest: this.ui, t, f: 1320, dur: 1.2, gain: 0.1 }); this.tone({ dest: this.ui, t, f: 2640 * 1.01, dur: 0.6, gain: 0.03 }); }); }
  tick() { this.tone({ dest: this.ui, f: 2400, dur: 0.02, gain: 0.05 }); }

  // ───── 音楽 ─────
  setMusic(mode) { this.musicMode = mode; this.nextPhrase = 0; }
  updateMusic(dt) {
    this.updateAmbience(dt);
    if (!this.ctx || this.musicMode === 'none') return;
    this.nextPhrase -= dt;
    if (this.nextPhrase > 0) return;
    const r = Math.random;
    if (this.musicMode === 'title') {
      // 夜の琴（都節）: ゆっくり、間をあけて
      const phrases = [[4, 3, 2, 3, 4], [5, 4, 3, 4, 2, 1, 2], [7, 5, 4, 5, 3], [2, 3, 4, 5, 4, 3]];
      const ph = phrases[Math.floor(r() * phrases.length)];
      let t = 0;
      ph.forEach((k, i) => {
        this.pluck(miyako(64, k), { t, gain: 0.17, bright: 0.55, dur: 2.2 });
        t += i === ph.length - 1 ? 0 : [0.42, 0.42, 0.84][Math.floor(r() * 3)];
      });
      this.pluck(miyako(52, ph[0] % 5), { t: 0, gain: 0.12, dur: 3, bright: 0.3 });
      this.nextPhrase = t + 3 + r() * 2.5;
    } else if (this.musicMode === 'play') {
      // 遊んでいる間は、ときどき琴がぽろん
      const k = Math.floor(r() * 7);
      this.pluck(miyako(69, k), { gain: 0.05, bright: 0.5, dur: 2 });
      if (r() < 0.4) this.pluck(miyako(69, k + 2), { t: 0.45, gain: 0.04, bright: 0.5, dur: 2 });
      this.nextPhrase = 9 + r() * 12;
    } else if (this.musicMode === 'results') {
      const ph = [0, 2, 4, 5, 4, 2, 4, 7, 5, 4, 2, 0];
      ph.forEach((k, i) => this.pluck(yona(64, k), { t: i * 0.22, gain: 0.2, bright: 0.65 }));
      [0, 0.88, 1.76].forEach((t) => this.taiko(t, 0.22, 80, this.musicIn));
      this.nextPhrase = 4.5;
    }
  }
}

export const audio = new AudioEngine();
