// 環境音くらいの静かな音楽（Web Audioでその場で合成）
// ・ヨナ抜き長音階（F G A C D）の柔らかな和音がゆっくり移り変わる
// ・ときどき、オルゴールや親指ピアノのような音がぽつりぽつり
// ・泡を運ぶ風と同じ突風に合わせて、かすかな風の音
// 同じ組み立てを OfflineAudioContext でも使える（書き出して耳以外で確かめるため）
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALE_PC = [5, 7, 9, 0, 2]; // F G A C D

// 和音：低い音は根音、上は開いた配置
const CHORDS = [
  { name: 'Fadd9', pad: [41, 48, 57, 60, 67], tones: [5, 9, 0, 7] },
  { name: 'Dm11', pad: [38, 45, 53, 60, 67], tones: [2, 5, 9, 0, 7] },
  { name: 'Bbmaj9', pad: [46, 53, 57, 62, 72], tones: [9, 2, 5, 0] },
  { name: 'Csus', pad: [48, 55, 62, 65, 69], tones: [0, 7, 2, 5, 9] },
  { name: 'Gm7', pad: [43, 50, 53, 58, 62], tones: [7, 2, 5, 9] },
];
const PROGRESSION = [0, 1, 2, 3, 0, 4, 2, 3];

export class Ambient {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.level = 1.1;
    this.windLevel = 1.4;
    this.params = { gust: 0.3, speed: 1.6, alt: 2, state: 'title' };
    this.offline = false;
  }

  // 最初の操作（クリックなど）で呼ぶ
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'playback' }); } catch { return; }
      this.build(this.ctx);
      this.start(this.ctx.currentTime + 0.1);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  now() { return this.ctx.currentTime; }

  build(ctx) {
    this.ctx = ctx;
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    this.master = g(0);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.03; comp.release.value = 0.6;
    this.master.connect(comp).connect(ctx.destination);
    // 残響（生成したインパルス応答）
    this.rev = ctx.createConvolver();
    this.rev.buffer = this.makeIR(ctx, 5.2);
    this.revOut = g(0.5);
    this.rev.connect(this.revOut).connect(this.master);
    // 粒の音のこだま
    this.dly = ctx.createDelay(2.0);
    this.dly.delayTime.value = 0.48;
    const fb = g(0.3), dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    this.dly.connect(dlp).connect(fb).connect(this.dly);
    const dwet = g(0.2);
    dlp.connect(dwet);
    dwet.connect(this.master);
    const dRev = g(0.35); dwet.connect(dRev).connect(this.rev);
    // 和音のバス
    this.padBus = g(1.0);
    const padHP = ctx.createBiquadFilter(); padHP.type = 'highpass'; padHP.frequency.value = 60; padHP.Q.value = 0.5;
    this.padBus.connect(padHP).connect(this.master);
    // 根音：低すぎる成分を切って柔らかく
    this.padLow = g(1.0);
    const lowHP = ctx.createBiquadFilter(); lowHP.type = 'highpass'; lowHP.frequency.value = 55; lowHP.Q.value = 0.5;
    const lowLP = ctx.createBiquadFilter(); lowLP.type = 'lowpass'; lowLP.frequency.value = 420;
    this.padLow.connect(lowHP).connect(lowLP).connect(this.master);
    this.padRev = g(0.55); this.padBus.connect(this.padRev).connect(this.rev);
    this.padCut = 1100;
    // 粒の音のバス
    this.pluckBus = g(1.0);
    this.pluckDry = g(0.75); this.pluckBus.connect(this.pluckDry).connect(this.master);
    this.pluckBus.connect(this.dly);
    this.pluckRev = g(0.6); this.pluckBus.connect(this.pluckRev).connect(this.rev);
    // 効果音（吹く・割れる）
    this.sfx = g(1.0);
    this.sfx.connect(this.master);
    const sRev = g(0.25); this.sfx.connect(sRev).connect(this.rev);
    // 風
    this.noise = this.makeNoise(ctx, 6);
    this.click = this.makeClick(ctx);
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    this.windBP = ctx.createBiquadFilter(); this.windBP.type = 'bandpass'; this.windBP.frequency.value = 420; this.windBP.Q.value = 0.7;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 1600;
    this.windGain = g(0);
    this.windPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(this.windBP).connect(wlp).connect(this.windGain);
    if (this.windPan) this.windGain.connect(this.windPan).connect(this.master); else this.windGain.connect(this.master);
    this.windSrc = src;
  }

  // 生成したインパルス応答：前の反射＋暗くなっていく尾
  makeIR(ctx, dur) {
    const sr = ctx.sampleRate, n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, n, sr);
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = t < 0.018 ? 0 : Math.exp(-(t - 0.018) / 1.45);
        const a = 0.15 + 0.8 * Math.min(1, t / dur) ** 0.7;
        lp = lp * a + rnd() * (1 - a);
        d[i] = lp * env * (0.9 + 0.8 * Math.min(1, t / dur));
      }
      const er = [[0.011, 0.45], [0.023, 0.32], [0.037, 0.26], [0.052, 0.2], [0.071, 0.14]];
      for (const [tt, gg] of er) { const k = Math.floor((tt + c * 0.0017) * sr); if (k < n) d[k] += gg * (c ? -0.8 : 1); }
    }
    return buf;
  }

  // 少し低い音寄りの雑音（風用）
  makeNoise(ctx, dur) {
    const sr = ctx.sampleRate, n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, n, sr);
    let seed = 987654;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = rnd();
        b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.03) * 1.8;
      }
      // 直流を除き、大きさをそろえる（RMS 0.25・±1に収める）
      let mean = 0; for (let i = 0; i < n; i++) mean += d[i]; mean /= n;
      let rms = 0; for (let i = 0; i < n; i++) { d[i] -= mean; rms += d[i] * d[i]; } rms = Math.sqrt(rms / n);
      for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, d[i] / rms * 0.25));
      // つなぎ目をなめらかに
      const fade = Math.floor(sr * 0.05);
      for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[n - fade + i] * (1 - k); }
    }
    return buf;
  }

  // 短い白色雑音（割れる音用、直流なし）
  makeClick(ctx) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 0.08);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let seed = 4242;
    for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296 * 2 - 1) * 0.5; }
    return buf;
  }

  start(t) {
    this.t0 = t;
    this.nextChord = t;
    this.chordIdx = 0;
    this.nextBeat = t + 3.2;
    this.beat = 0.84;
    this.mel = { idx: 6, left: 0, rest: 2 };
    this.nextArp = t + 38;
    this.windSrc.start(t);
    // ゆっくり立ち上げる
    this.master.gain.setValueAtTime(0, t);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : this.level, t + 6);
    this.started = true;
    this.schedule(t + 0.5);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx || !this.started) return;
    const t = this.now();
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(m ? 0 : this.level, t + (m ? 0.5 : 1.5));
  }

  // 和音：5.5秒でふくらみ、次の和音と重なりながら7秒で消える
  playChord(t, chord, dur) {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + 5.5);
    bus.gain.setValueAtTime(1, t + dur);
    bus.gain.linearRampToValueAtTime(0, t + dur + 7);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.35;
    const cut = this.padCut;
    lp.frequency.setValueAtTime(cut * 0.65, t);
    lp.frequency.linearRampToValueAtTime(cut * 1.15, t + dur * 0.55);
    lp.frequency.linearRampToValueAtTime(cut * 0.7, t + dur + 7);
    // ゆらぎ用の段（包絡とは別に掛けるので、包絡が0なら必ず無音）
    const trem = ctx.createGain();
    trem.gain.value = 1;
    bus.connect(trem).connect(lp).connect(this.padBus);
    const end = t + dur + 7.2;
    const oscs = [];
    const lowest = Math.min(...chord.pad);
    for (const m of chord.pad) {
      const f = mtof(m);
      if (m === lowest) {
        // 根音：うなりを作らないよう1本だけ。消えるのは早め（次の和音の根音と重ならない）
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t);
        og.gain.linearRampToValueAtTime(0.022, t + 4);
        og.gain.setValueAtTime(0.022, t + dur);
        og.gain.linearRampToValueAtTime(0, t + dur + 2.5);
        o.connect(og).connect(this.padLow);
        o.start(t); o.stop(t + dur + 2.7);
        continue;
      }
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det + (Math.random() - 0.5) * 2;
        const og = ctx.createGain();
        og.gain.value = 0.0085;
        o.connect(og).connect(bus);
        o.start(t); o.stop(end);
        oscs.push(o);
      }
    }
    // ゆらぎ：和音全体の大きさがゆっくり揺れる
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.06 + Math.random() * 0.04; lg.gain.value = 0.06;
    lfo.connect(lg).connect(trem.gain);
    lfo.start(t); lfo.stop(end);
    oscs[0].onended = () => { try { bus.disconnect(); trem.disconnect(); lp.disconnect(); } catch {} };
  }

  // 粒の音：FM合成（親指ピアノ〜オルゴールの間）
  pluck(t, midi, vel = 1, pan = 0, bright = 0) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * (bright > 0.5 ? 3.0 : 2.0);
    const mg = ctx.createGain();
    const idx0 = f * (bright > 0.5 ? 1.1 : 1.6) * vel;
    mg.gain.setValueAtTime(idx0, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.02), t + (bright > 0.5 ? 1.8 : 0.9));
    mod.connect(mg).connect(car.frequency);
    // かすかな高い倍音（鈴のきらめき）
    const sh = ctx.createOscillator();
    sh.frequency.value = f * 4.02;
    const shg = ctx.createGain();
    shg.gain.setValueAtTime(0, t);
    shg.gain.linearRampToValueAtTime(0.01 * vel, t + 0.004);
    shg.gain.exponentialRampToValueAtTime(0.00005, t + 0.9);
    const env = ctx.createGain();
    const peak = 0.11 * vel;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.006);
    env.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35);
    env.gain.exponentialRampToValueAtTime(0.00008, t + 3.6);
    let out = env;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; env.connect(p); out = p; }
    car.connect(env);
    sh.connect(shg).connect(env);
    out.connect(this.pluckBus);
    const end = t + 3.8;
    car.start(t); mod.start(t); sh.start(t);
    car.stop(end); mod.stop(end); sh.stop(end);
    car.onended = () => { try { out.disconnect(); env.disconnect(); mg.disconnect(); shg.disconnect(); } catch {} };
  }

  scaleNotes(lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (SCALE_PC.includes(((m % 12) + 12) % 12)) out.push(m);
    return out;
  }

  // 先の時刻 until までの音を予約する（毎フレーム呼ぶ）
  schedule(until) {
    if (!this.started) return;
    // 画面が止まっていた後に、たまった音をまとめて鳴らさない
    const lag = until - 0.6;
    if (this.nextBeat < lag - 0.2) this.nextBeat = lag + 0.3;
    if (this.nextArp < lag - 0.2) this.nextArp = lag + 20;
    if (this.nextChord < lag - 4) this.nextChord = lag + 0.2;
    const p = this.params;
    const high = Math.min(1, Math.max(0, (p.alt - 15) / 60));
    while (this.nextChord < until) {
      const chord = CHORDS[PROGRESSION[this.chordIdx % PROGRESSION.length]];
      const dur = 15 + Math.random() * 5;
      this.playChord(this.nextChord, chord, dur);
      this.curChord = chord;
      this.chordIdx++;
      this.nextChord += dur;
    }
    const notes = this.scaleNotes(69, 88);
    while (this.nextBeat < until) {
      const t = this.nextBeat;
      this.nextBeat += this.beat * (Math.random() < 0.18 ? 1.5 : 1) * (Math.random() < 0.08 ? 2 : 1);
      const M = this.mel;
      if (M.rest > 0) { M.rest--; continue; }
      if (M.left <= 0) {
        const density = 0.32 + 0.22 * high;
        if (Math.random() < density) M.left = 2 + Math.floor(Math.random() * 4);
        else { M.rest = 2 + Math.floor(Math.random() * 5); continue; }
      }
      // 次の音：一つ二つ隣へ。和音の音と真ん中の高さに寄る
      const chord = this.curChord || CHORDS[0];
      let best = M.idx, bestS = -1e9;
      for (let c = 0; c < 6; c++) {
        const step = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
        const i = Math.max(0, Math.min(notes.length - 1, M.idx + step));
        const pc = notes[i] % 12;
        const s = (chord.tones.includes(pc) ? 1.2 : 0) - Math.abs(i - notes.length * 0.45) * 0.12 + Math.random() * 0.9 - (i === M.idx ? 1 : 0);
        if (s > bestS) { bestS = s; best = i; }
      }
      M.idx = best;
      const vel = 0.55 + Math.random() * 0.4;
      const pan = (Math.random() - 0.5) * 0.9;
      this.pluck(t + (Math.random() - 0.5) * 0.03, notes[M.idx], vel, pan, 0);
      if (Math.random() < 0.13 && M.idx > 2) this.pluck(t + 0.015, notes[M.idx - 3], vel * 0.55, -pan, 0);
      M.left--;
      if (M.left <= 0) M.rest = 3 + Math.floor(Math.random() * 8);
    }
    // ときどき、オルゴールのような分散和音
    while (this.nextArp < until) {
      const t = this.nextArp;
      const chord = this.curChord || CHORDS[0];
      const up = this.scaleNotes(72, 91).filter((m) => chord.tones.includes(m % 12)).slice(0, 5);
      up.forEach((m, i) => this.pluck(t + i * 0.19 + Math.random() * 0.02, m, 0.42 - i * 0.04, -0.4 + i * 0.2, 1));
      this.nextArp += 45 + Math.random() * 35;
    }
  }

  // 毎フレーム：風の音と、高さによる響きの変化
  update(dt, p) {
    if (!this.ctx || !this.started) return;
    Object.assign(this.params, p);
    const t = this.now();
    this.applyParams(t);
    this.schedule(t + 0.6);
  }

  applyParams(t) {
    const p = this.params;
    const gust = Math.max(0, Math.min(1, p.gust));
    const riding = p.state === 'ride' || p.state === 'follow' || p.state === 'blow';
    const w = (0.01 + 0.085 * gust * gust * Math.min(1.4, p.speed / 1.8)) * (riding ? 1 : 0.55) * this.windLevel;
    this.windGain.gain.setTargetAtTime(this.windMute ? 0 : w, t, 0.5);
    this.windBP.frequency.setTargetAtTime(280 + 520 * gust + Math.min(p.alt, 80) * 2, t, 0.6);
    if (this.windPan) this.windPan.pan.setTargetAtTime(Math.sin(t * 0.13) * 0.4, t, 1.0);
    // 高いところでは響きが広く、和音が少し明るい
    const high = Math.min(1, Math.max(0, (p.alt - 15) / 60));
    this.padCut = 1000 + 700 * high;
    this.revOut.gain.setTargetAtTime(0.5 + 0.25 * high, t, 2.0);
  }

  // しゃぼん玉を吹く息
  blow(t = this.ctx ? this.now() : 0) {
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.12);
    g.gain.linearRampToValueAtTime(0.06, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0003, t + 1.6);
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.linearRampToValueAtTime(1300, t + 1.2);
    src.connect(bp).connect(lp).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 3);
    src.stop(t + 1.7);
  }

  // 割れる音：小さな「ぷちっ」（高い音程の成分は入れない。続けて鳴りすぎないよう間を空ける）
  pop(strength = 1, t = this.ctx ? this.now() : 0) {
    if (!this.ctx || !this.started || strength <= 0.01) return;
    if (this.lastPop !== undefined && t - this.lastPop < 0.35 && strength < 0.9) return;
    this.lastPop = t;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.click;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035 * strength, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0002, t + 0.035);
    src.connect(bp).connect(lp).connect(g).connect(this.sfx);
    src.start(t); src.stop(t + 0.05);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
}

// 確かめ用：数十秒をオフラインで合成して WAV にする
// script: 書き出した映像の記録 { events:[{t,type:'blow'|'pop',s}], samples:[{t,g,sp,alt,st}]（0.1秒ごと）, arpAt }
export async function renderOffline(seconds = 90, stems = null, script = null) {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, sr * seconds, sr);
  const a = new Ambient();
  a.offline = true;
  a.build(ctx);
  if (stems) {
    if (!stems.includes('pads')) { a.padBus.gain.value = 0; a.padLow.gain.value = 0; }
    if (!stems.includes('plucks')) a.pluckBus.gain.value = 0;
    if (!stems.includes('wind')) a.windGain.connect(ctx.createGain()) && (a.windMute = true);
    if (!stems.includes('sfx')) a.sfx.gain.value = 0;
  }
  let simT = 0;
  a.now = () => simT;
  a.start(0.05);
  if (script && script.arpAt != null) a.nextArp = script.arpAt;
  const ev = script ? script.events.slice().sort((x, y) => x.t - y.t) : null;
  for (let i = 0; (simT = i * 0.1) < seconds; i++) {
    if (script) {
      const s = script.samples[Math.min(script.samples.length - 1, i)];
      a.params = { gust: s.g, speed: s.sp, alt: s.alt, state: s.st };
    } else {
      const g = 0.5 + 0.5 * Math.sin(simT / 7.3) * Math.sin(simT / 3.1 + 1);
      a.params = { gust: g, speed: 1.8, alt: simT > 40 && simT < 70 ? 60 : 3, state: 'ride' };
    }
    a.applyParams(simT);
    a.schedule(simT + 0.6);
    if (script) {
      while (ev.length && ev[0].t < simT + 0.1) { const e = ev.shift(); if (e.type === 'blow') a.blow(e.t); else a.pop(e.s, e.t); }
    } else {
      if (Math.abs(simT - 1) < 0.05) a.blow(simT);
      if (Math.abs(simT - 75) < 0.05) a.pop(1, simT);
      if (Math.abs(simT - 30) < 0.05) a.pop(0.4, simT);
    }
  }
  const buf = await ctx.startRendering();
  return encodeWav(buf);
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([out.buffer], { type: 'audio/wav' });
}
