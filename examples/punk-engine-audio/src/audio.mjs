import { clamp, IDLE, LIMIT } from './drive.mjs';
const original = name => new URL('../original/' + name, import.meta.url);
async function response(name) {
  const res = await fetch(original(name));
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res;
}
export class EngineAudio {
  context; nodes = {}; meters = {}; gains = {}; mode = 'sampler'; releases = 0;
  async start() {
    const c = this.context = new AudioContext();
    await c.resume();
    const decode = async name => c.decodeAudioData(await (await response(name)).arrayBuffer());
    const [bank, turbo, recording, release] = await Promise.all([
      response('audio/engine/v8.json').then(r=>r.json()),
      response('audio/turbo/releases.json').then(r=>r.json()),
      decode('audio/engine/v8.wav'), decode('audio/turbo/releases.wav'),
      c.audioWorklet.addModule(original('assets/engineSampler.worklet-CiauAed6.js')),
      c.audioWorklet.addModule(original('assets/engineSynth.worklet-tkiTUezc.js')),
    ]);
    this.bus = c.createGain();
    const compressor = c.createDynamicsCompressor();
    for (const [name,value] of Object.entries({threshold:-1.5,knee:17,ratio:8.1,attack:.021,release:.16})) compressor[name].value=value;
    this.master = c.createGain(); this.master.gain.value=.3;
    this.output = c.createAnalyser(); this.output.fftSize=2048;
    this.bus.connect(compressor).connect(this.master).connect(this.output).connect(c.destination);
    for (const mode of ['sampler','synth']) {
      const node = this.nodes[mode] = new AudioWorkletNode(c, 'engine-'+mode,
        {numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[mode==='sampler'?2:1]});
      node.onprocessorerror = () => { this.error = `engine-${mode} processor failed`; };
      const meter = this.meters[mode] = c.createAnalyser(); meter.fftSize=2048;
      node.connect(meter); // Measure raw worklet output before mix gain.
      let tail = node;
      for (const frequency of [45,90,180,360,720,1400,2800,5600]) {
        const eq = c.createBiquadFilter(); eq.type='peaking'; eq.frequency.value=frequency;
        eq.Q.value=2.05; eq.gain.value=({45:4.5,90:8,5600:12.5})[frequency]??0;
        tail.connect(eq); tail=eq;
      }
      const gain = this.gains[mode] = c.createGain(); gain.gain.value=0;
      tail.connect(gain).connect(this.bus);
    }
    // Qk's payload. decodeAudioData may resample; send the decoded rate, not JSON rate.
    this.nodes.sampler.port.postMessage({samples:recording.getChannelData(0).slice(),
      sampleRate:recording.sampleRate,times:bank.points.map(p=>p[0]),freqs:bank.points.map(p=>p[1]),
      gains:bank.points.map(p=>p[2]),rpmPerHz:bank.rpmPerHz,cylinders:bank.cylinders??8,rpmRange:[IDLE,LIMIT]});
    this.releaseBuffers = {};
    for (const name of ['long-a','long-b']) {
      const [offset,length] = turbo.takes[name], scale = release.sampleRate/turbo.sampleRate;
      const samples = release.getChannelData(0).slice(Math.round(offset*scale),Math.round((offset+length)*scale));
      const buffer = c.createBuffer(1,samples.length,c.sampleRate); buffer.copyToChannel(samples,0);
      this.releaseBuffers[name]=buffer;
    }
    this.turboMeter=c.createAnalyser(); this.turboMeter.fftSize=2048;
    this.turboBus=c.createGain(); this.turboBus.connect(this.turboMeter); this.turboBus.connect(this.bus);
    this.data=new Float32Array(2048);
  }
  update(state) {
    const now=this.context.currentTime, load=clamp(state.load);
    for (const [mode,node] of Object.entries(this.nodes)) {
      node.parameters.get('rpm').setTargetAtTime(state.rpm,now,.012);
      node.parameters.get('load').setTargetAtTime(load,now,.03);
      node.parameters.get('throttle').setTargetAtTime(state.throttle,now,.02);
      this.gains[mode].gain.setTargetAtTime(mode===this.mode?(.46+load*.19)*(mode==='sampler'?1:.52):0,now,.05);
    }
    if (state.releaseStrength) this.blowoff(state.releaseStrength);
  }
  blowoff(strength) {
    const c=this.context, now=c.currentTime+.035;
    // Host playback of original Quadra release takes, rates and twin delay.
    // Full game's synthesized flutter/body/echo graph is intentionally outside this host.
    for (const [name,rate,delay,level] of [['long-a',.72,0,1],['long-b',.68,.025,.55]]) {
      const source=c.createBufferSource(); source.buffer=this.releaseBuffers[name]; source.playbackRate.value=rate;
      const filter=c.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=8000;
      const gain=c.createGain(); const at=now+delay, end=at+.65;
      gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime((.35+.65*strength)*.75*level,at+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,end);
      source.connect(filter).connect(gain).connect(this.turboBus);
      source.start(at); source.stop(end+.03);
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    }
    this.releases++;
  }
  rms(meter) {
    meter.getFloatTimeDomainData(this.data);
    return Math.sqrt(this.data.reduce((sum,x)=>sum+x*x,0)/this.data.length);
  }
  snapshot() {
    return {context:this.context.state,mode:this.mode,error:this.error??null,
      worklets:Object.fromEntries(Object.entries(this.nodes).map(([mode,node])=>[mode,{
        rms:this.rms(this.meters[mode]),parameters:Object.fromEntries([...node.parameters].map(([k,p])=>[k,p.value]))
      }])),rms:this.rms(this.output),turboRms:this.rms(this.turboMeter),releases:this.releases};
  }
}
