import { distance, type GameEvent, type Simulation, type Species, type Vec } from './simulation';
import { MusicScore } from './music';

/** Gesture-started procedural sound: wind, propellers, soft music and spatial cues. */
export class Soundscape {
  enabled = true;
  private context?: AudioContext;
  private master?: GainNode;
  private effects?: GainNode;
  private music?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private wind?: GainNode;
  private windFilter?: BiquadFilterNode;
  private engine?: GainNode;
  private engineTone?: OscillatorNode;
  private engineHarmonic?: OscillatorNode;
  private engineGear?: OscillatorNode;
  private engineFilter?: BiquadFilterNode;
  private propeller?: OscillatorNode;
  private propellerAmount?: GainNode;
  private captureTone?: OscillatorNode;
  private captureGain?: GainNode;
  private voices = 0;
  private peakVoices = 0;
  private tone = 0;
  private score?: MusicScore;
  private nextCall = 1.8;
  private callSequence = 0;
  private lastCaptureTarget?: number;
  private wasBoosting = false;
  private listener: Vec = { x: 0, y: 17, z: 28 };
  private yaw = 0;
  private eventCounts: Record<string, number> = {};

  constructor() {
    try { this.enabled = localStorage.getItem('cloudkeep.sound') !== 'off'; } catch { /* Session preference still works. */ }
  }

  async start() {
    if (!this.enabled) return false;
    if (!this.context) this.initialize();
    await this.context!.resume();
    this.master!.gain.setTargetAtTime(.68, this.context!.currentTime, .12);
    return true;
  }

  async toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('cloudkeep.sound', this.enabled ? 'on' : 'off'); } catch { /* No storage is required for audio. */ }
    if (this.enabled) await this.start();
    else if (this.context) this.master!.gain.setTargetAtTime(0, this.context.currentTime, .08);
    return this.enabled;
  }

  private initialize() {
    const ctx = this.context = new AudioContext();
    const master = this.master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 4;
    compressor.attack.value = .006; compressor.release.value = .22; compressor.connect(master);
    const effects = this.effects = ctx.createGain(); effects.connect(compressor);
    const music = this.music = ctx.createGain(); music.gain.value = 0; music.connect(effects);
    this.score = new MusicScore(ctx, music);
    const reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, ctx.sampleRate * 2.4, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3 * .32;
    }
    reverb.buffer = impulse;
    const wet = ctx.createGain(); wet.gain.value = .17;
    effects.connect(reverb); reverb.connect(wet); wet.connect(compressor);
    const noise = this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const windSource = ctx.createBufferSource(); windSource.buffer = noise; windSource.loop = true;
    const windFilter = this.windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 450;
    const wind = this.wind = ctx.createGain(); wind.gain.value = 0;
    windSource.connect(windFilter); windFilter.connect(wind); wind.connect(compressor); windSource.start();
    const engine = this.engine = ctx.createGain(); engine.gain.value = 0; engine.connect(compressor);
    const lowpass = this.engineFilter = ctx.createBiquadFilter(); lowpass.frequency.value = 380; lowpass.Q.value = .5; lowpass.connect(engine);
    const base = this.engineTone = ctx.createOscillator(); base.type = 'triangle'; base.frequency.value = 48; base.connect(lowpass); base.start();
    const harmonic = this.engineHarmonic = ctx.createOscillator(); harmonic.type = 'sine'; harmonic.frequency.value = 96; harmonic.connect(lowpass); harmonic.start();
    const gear = this.engineGear = ctx.createOscillator(); gear.type = 'sawtooth'; gear.frequency.value = 144;
    const gearAmount = ctx.createGain(); gearAmount.gain.value = .18; gear.connect(gearAmount); gearAmount.connect(lowpass); gear.start();
    const propeller = this.propeller = ctx.createOscillator(); propeller.frequency.value = 13;
    const amount = this.propellerAmount = ctx.createGain(); amount.gain.value = 0;
    propeller.connect(amount); amount.connect(engine.gain); propeller.start();
    const capture = this.captureTone = ctx.createOscillator(); capture.type = 'sine'; capture.frequency.value = 310;
    const captureGain = this.captureGain = ctx.createGain(); captureGain.gain.value = 0;
    capture.connect(captureGain); captureGain.connect(effects); capture.start();
  }

  private note(frequency: number, duration: number, volume: number, pan = 0, slide = 1, delay = 0, music = false, type: OscillatorType = 'sine') {
    if (!this.context || !this.effects || this.voices >= 40) return;
    const ctx = this.context, now = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * slide), now + duration * .8);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + Math.min(.025, duration * .1));
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    stereo.pan.value = Math.max(-.8, Math.min(.8, pan));
    osc.connect(gain); gain.connect(stereo); stereo.connect(music ? this.music! : this.effects);
    this.voices++; this.peakVoices = Math.max(this.peakVoices, this.voices);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); stereo.disconnect(); this.voices--; };
    osc.start(now); osc.stop(now + duration + .03);
  }

  private breath(duration: number, volume: number, frequency: number, endFrequency: number, pan = 0) {
    if (!this.context || !this.effects || this.voices >= 40) return;
    const ctx = this.context, now = ctx.currentTime;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    source.buffer = this.noiseBuffer!; filter.type = 'bandpass'; filter.Q.value = .65;
    filter.frequency.setValueAtTime(frequency, now); filter.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + .035); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    stereo.pan.value = Math.max(-.8, Math.min(.8, pan));
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(this.effects);
    this.voices++; this.peakVoices = Math.max(this.peakVoices, this.voices);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); stereo.disconnect(); this.voices--; };
    source.start(now, Math.random()); source.stop(now + duration + .04);
  }

  private chirp(pitches: number[], duration: number, volume: number, pan: number, flutter = .025, delay = 0) {
    if (!this.context || !this.effects || this.voices >= 40) return;
    const ctx = this.context, now = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    const curve = new Float32Array(80);
    for (let i = 0; i < curve.length; i++) {
      const t = i / (curve.length - 1), part = Math.min(pitches.length - 2, Math.floor(t * (pitches.length - 1)));
      const blend = t * (pitches.length - 1) - part, ease = blend * blend * (3 - 2 * blend);
      curve[i] = (pitches[part] * (1 - ease) + pitches[part + 1] * ease) * (1 + Math.sin(t * 53) * flutter);
    }
    osc.frequency.setValueCurveAtTime(curve, now, duration);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    stereo.pan.value = Math.max(-.8, Math.min(.8, pan));
    osc.connect(gain); gain.connect(stereo); stereo.connect(this.effects);
    this.voices++; this.peakVoices = Math.max(this.peakVoices, this.voices);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); stereo.disconnect(); this.voices--; };
    osc.start(now); osc.stop(now + duration + .03);
  }

  private creatureVoice(species: Species, amount: number, pan: number) {
    switch (species) {
      case 'bird':
        this.chirp([1350, 2300, 1740, 2100], .24, .13 * amount, pan, .04);
        this.chirp([1680, 2480, 1900], .19, .10 * amount, pan, .03, .28); break;
      case 'moth':
        this.breath(.28, .065 * amount, 2300, 3600, pan);
        this.note(1174.66, 1.1, .10 * amount, pan); this.note(1760, .75, .046 * amount, -pan, 1, .12); break;
      case 'koi':
        this.chirp([280, 950, 440], .25, .18 * amount, pan, .015);
        this.chirp([540, 1180, 740], .18, .11 * amount, pan, .01, .20); break;
      case 'jelly':
        this.note(659.25, 1.8, .10 * amount, pan); this.note(1318.51, 1.1, .045 * amount, -pan, 1, .16);
        this.chirp([620, 820, 1046.5], .65, .06 * amount, pan, .04); break;
      case 'ray':
        this.chirp([670, 970, 750, 840], .46, .15 * amount, pan, .025);
        this.chirp([1120, 1280, 980], .22, .065 * amount, pan, .02, .31); break;
      case 'whale':
        this.chirp([126, 190, 157, 225], 1.85, .17 * amount, pan, .045);
        this.chirp([275, 380, 320, 260], 1.5, .065 * amount, pan, .025, .17); break;
    }
  }

  update(game: Simulation, playing: boolean) {
    this.listener = { ...game.pos }; this.yaw = game.yaw;
    if (!this.context) return;
    const now = this.context.currentTime;
    const active = playing && this.enabled;
    const speed = active ? Math.min(game.speed / 18, 1) : 0, boost = active && game.boosting;
    this.wind!.gain.setTargetAtTime(active ? .045 + speed * .18 + Number(boost) * .11 : 0, now, .18);
    this.windFilter!.frequency.setTargetAtTime(350 + speed * 1300 + Number(boost) * 900, now, .16);
    this.engine!.gain.setTargetAtTime(active ? .025 + speed * .028 + Number(boost) * .033 : 0, now, active ? .28 : .12);
    this.propellerAmount!.gain.setTargetAtTime(active ? .006 + speed * .004 + Number(boost) * .012 : 0, now, .25);
    this.propeller!.frequency.setTargetAtTime(12 + speed * 9 + Number(boost) * 9, now, boost ? .36 : .55);
    const engineHz = 46 + speed * 32 + Number(boost) * 16;
    this.engineTone!.frequency.setTargetAtTime(engineHz, now, boost ? .36 : .55);
    this.engineHarmonic!.frequency.setTargetAtTime(engineHz * 2.005, now, boost ? .36 : .55);
    this.engineGear!.frequency.setTargetAtTime(engineHz * 3.01, now, boost ? .36 : .55);
    this.engineFilter!.frequency.setTargetAtTime(320 + speed * 210 + Number(boost) * 290, now, .35);
    const target = game.creatures.find(c => c.id === game.captureTarget);
    this.captureGain!.gain.setTargetAtTime(active && target ? .047 : 0, now, .045);
    this.captureTone!.frequency.setTargetAtTime(280 + (target?.capture ?? 0) * 500 + Math.sin(game.time * 17) * 16, now, .035);
    if (active && target && target.id !== this.lastCaptureTarget) this.chirp([430, 860, 620], .22, .075, 0);
    this.lastCaptureTarget = target?.id;
    this.music!.gain.setTargetAtTime(active ? (boost ? .42 : .70) : 0, now, active ? 1.6 : .25);
    this.score!.update(active);
    if (boost !== this.wasBoosting) {
      if (active) {
        this.breath(boost ? .65 : .55, boost ? .18 : .10, boost ? 240 : 1200, boost ? 1750 : 220);
        if (boost) {
          this.note(92, .16, .10, 0, .55, 0, false, 'triangle');
          this.note(130, .75, .055, 0, 1.7, .06, false, 'triangle');
        } else this.note(190, .85, .04, 0, .44, 0, false, 'triangle');
        const key = boost ? 'boostStart' : 'boostEnd'; this.eventCounts[key] = (this.eventCounts[key] ?? 0) + 1;
      }
      this.wasBoosting = boost;
    }
    if (active && game.time >= this.nextCall) {
      this.nextCall = game.time + 2.7 + Math.random() * 2.1;
      const nearby = game.creatures.filter(c => c.spawn >= 1 && c.mode !== 'capturing' && distance(c.pos, game.pos) < 52).sort((a, b) => distance(a.pos, game.pos) - distance(b.pos, game.pos)).slice(0, 3);
      if (nearby.length) {
        const creature = nearby[this.callSequence++ % nearby.length], gap = distance(creature.pos, game.pos);
        const pan = ((creature.pos.x - game.pos.x) * Math.cos(game.yaw) - (creature.pos.z - game.pos.z) * Math.sin(game.yaw)) / Math.max(8, gap);
        this.creatureVoice(creature.species, .75 / (1 + gap * .025), pan);
        const key = `call:${creature.species}`; this.eventCounts[key] = (this.eventCounts[key] ?? 0) + 1;
      }
    }
  }

  play(event: GameEvent) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    this.eventCounts[event.type] = (this.eventCounts[event.type] ?? 0) + 1;
    const gap = distance(event.pos, this.listener), volume = 1 / (1 + gap * .035);
    const dx = event.pos.x - this.listener.x, dz = event.pos.z - this.listener.z;
    const pan = (dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw)) / Math.max(8, gap);
    const bell = (frequency: number, duration = .65, strength = .16, delay = 0) => this.note(frequency, duration, strength * volume, pan, 1, delay);
    switch (event.type) {
      case 'feed': this.note(290, .18, .14 * volume, pan, .4); this.breath(.13, .05 * volume, 1800, 700, pan); break;
      case 'collision':
        this.note(78, .32, .22 * volume, pan, .4, 0, false, 'triangle');
        this.breath(.27, Math.min(.65, .18 + (event.value ?? 0) * .025) * volume, 700, 120, pan); break;
      case 'capture': {
        this.creatureVoice(event.species!, volume, pan);
        this.breath(.45, .16 * volume, 500, 2600, pan);
        [659.25, 880, 1174.66].forEach((f, i) => bell(f, .8, .10, .12 + i * .075)); break;
      }
      case 'collect': {
        const frequency = [783.99, 880, 1046.5, 1174.66, 1318.51][this.tone++ % 5];
        bell(frequency, .42, .16); bell(frequency * 2, .22, .035); break;
      }
      case 'eat': this.creatureVoice(event.species!, volume * .8, pan); bell(783.99, .65, .065, .1); break;
      case 'respawn': if (gap < 60) { bell(1046.5, 1.5, .065); this.creatureVoice(event.species!, volume * .55, pan); } break;
      case 'upgrade': [523.25, 659.25, 783.99].forEach((f, i) => bell(f, .9, .12, i * .1)); break;
      case 'complete': [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((f, i) => bell(f, 1.8, .13, i * .15)); break;
    }
  }

  get stats() { return { enabled: this.enabled, state: this.context?.state ?? 'not-started', voices: this.voices, peakVoices: this.peakVoices, music: this.score?.stats, events: { ...this.eventCounts } }; }
}
