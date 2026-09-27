// Overlapping open intervals, with irregular entrances and no melodic pulse.
const TONES = [57, 64, 62, 55, 62, 69, 57, 64, 66, 55, 62, 64];
const SPACES = [8.7, 7.3, 10.1, 8.2, 9.6, 7.8, 9.3, 8.1, 10.7, 7.6, 9.4, 11.2];
const LEVELS = [.034, .018, .025, .030, .022, .010, .030, .018, .011, .026, .020, .012];

/** Quiet, beatless air tones. The audio clock only schedules slow overlapping fades. */
export class MusicScore {
  private step = 0;
  private nextTime = 0;
  private active = false;
  private voices = 0;
  private scheduled = 0;
  private mix: GainNode;
  private air: AudioBuffer;

  constructor(private context: AudioContext, output: GainNode) {
    const ctx = context;
    this.mix = ctx.createGain();
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1250; filter.Q.value = .4;
    const dry = ctx.createGain(); dry.gain.value = .78;
    this.mix.connect(filter); filter.connect(dry); dry.connect(output);
    const reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 6.5), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let smooth = 0;
      for (let i = 0; i < data.length; i++) {
        smooth = smooth * .72 + (Math.random() * 2 - 1) * .28;
        data[i] = smooth * Math.exp(-i / data.length * 6) * Math.min(i / (ctx.sampleRate * .03), 1);
      }
    }
    reverb.buffer = impulse;
    const wet = ctx.createGain(); wet.gain.value = .42;
    filter.connect(reverb); reverb.connect(wet); wet.connect(output);
    this.air = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 5.7), ctx.sampleRate);
    const noise = this.air.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  }

  update(playing: boolean) {
    if (!playing || this.context.state !== 'running') { this.active = false; return; }
    const now = this.context.currentTime;
    if (!this.active) { this.active = true; this.nextTime = now + .1; }
    // A backgrounded tab resumes gently instead of catching up a queue of notes.
    if (this.nextTime < now - .3) this.nextTime = now + .1;
    if (this.nextTime < now + .2) {
      const index = this.step % TONES.length;
      this.swell(TONES[index], this.nextTime, 23 + index % 3 * 2.5, LEVELS[index], index);
      this.nextTime += SPACES[index];
      this.step = (this.step + 1) % TONES.length; this.scheduled++;
    }
  }

  private swell(midi: number, start: number, duration: number, volume: number, phrase: number) {
    if (this.voices >= 6) return;
    const ctx = this.context, frequency = 440 * 2 ** ((midi - 69) / 12);
    const gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    const envelope = new Float32Array(96), pan = new Float32Array(96);
    const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
    for (let i = 0; i < envelope.length; i++) {
      const t = i / (envelope.length - 1) * duration;
      envelope[i] = volume * smooth(t / 6) * smooth((duration - t) / 12);
      pan[i] = Math.sin(phrase * 2.1 + t * .065) * .32;
    }
    gain.gain.setValueCurveAtTime(envelope, start, duration);
    stereo.pan.setValueCurveAtTime(pan, start, duration);
    gain.connect(stereo); stereo.connect(this.mix);
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [gain, stereo];
    for (const [ratio, amount] of [[1, .78], [1.002, .16], [2.001, .07], [3.003, .012]]) {
      const osc = ctx.createOscillator(), level = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency * ratio; level.gain.value = amount;
      osc.detune.setValueAtTime(-1.5, start); osc.detune.linearRampToValueAtTime(1.5, start + duration);
      osc.connect(level); level.connect(gain); sources.push(osc); nodes.push(osc, level);
    }
    // A little filtered breath avoids a bare electronic sine tone.
    const air = ctx.createBufferSource(), airFilter = ctx.createBiquadFilter(), airLevel = ctx.createGain();
    air.buffer = this.air; air.loop = true; airFilter.type = 'bandpass'; airFilter.frequency.value = frequency * 2; airFilter.Q.value = .65;
    airLevel.gain.value = .09; air.connect(airFilter); airFilter.connect(airLevel); airLevel.connect(gain);
    sources.push(air); nodes.push(air, airFilter, airLevel);
    let remaining = sources.length;
    this.voices++;
    for (const source of sources) {
      source.onended = () => { if (--remaining === 0) { nodes.forEach(node => node.disconnect()); this.voices--; } };
      source.start(start); source.stop(start + duration + .02);
    }
  }

  get stats() { return { step: this.step, voices: this.voices, scheduled: this.scheduled, playing: this.active, style: 'beatless-air' }; }
}
