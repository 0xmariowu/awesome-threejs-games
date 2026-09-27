// 夏の音: 録音した素材（assets/sfx/town/）を鳴らす。出典は assets/sfx/town/licenses/SOURCES.md
// 音量は 全体 → 生き物の声（セミ・カエル・鳥）/ 環境音（波・風・水路・風鈴）/ 効果音（足音・知らせ・会話）の 3 つの系統
const BASE = new URL('../../assets/sfx/town/', import.meta.url);
const LOOPS = { cicada: 'cicada-bed', waves: 'waves', windSoft: 'wind-soft', windRush: 'wind-rush', creek: 'creek', frogs: 'frogs' };
const LOOP_BUS = { cicada: 'insects', frogs: 'insects', waves: 'env', windSoft: 'env', windRush: 'env', creek: 'env' };
const SHOTS = ['minmin', 'higurashi', 'tonbi', 'uguisu', 'furin', 'coin', 'give', 'bag', 'blip',
  ...['soil', 'gravel', 'grass', 'sand', 'asphalt'].flatMap((s) => ['step-' + s, 'run-' + s])];
const rand = (a, b) => a + Math.random() * (b - a);

export class Ambience {
  constructor() {
    this.ctx = null; this.on = true; this.vol = { master: 1, insects: 1, env: 1, sfx: 1 };
    this.buf = {}; this.loop = {}; this.last = {}; this.blipT = 0;
    // 読みこみは先にはじめておく（鳴らせるようになるのは start の後）
    this.files = fetch(new URL('manifest.json', BASE)).then((r) => r.json()).then((man) => {
      this.man = man;
      return Object.fromEntries([...Object.values(LOOPS), ...SHOTS].map((n) => [n, fetch(new URL(n + '.mp3', BASE)).then((r) => r.arrayBuffer())]));
    }).catch((e) => { console.warn('町の音を読みこめない', e); return {}; });
  }

  // 音量（0..1）を変える。鳴らしはじめる前でも覚えておく
  setVolume(k, v) {
    this.vol[k] = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (k === 'master') this.master.gain.setTargetAtTime(this.on ? 0.8 * v : 0, t, 0.05);
    else this.bus[k].gain.setTargetAtTime(v, t, 0.05);
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = 0.8 * this.vol.master;
    this.master.connect(c.destination);
    this.bus = {};
    for (const k of ['insects', 'env', 'sfx']) { const g = c.createGain(); g.gain.value = this.vol[k]; g.connect(this.master); this.bus[k] = g; }
    // 次に鳴らす時刻（ミンミンゼミ・ヒグラシ・鳥・風鈴）
    const t = c.currentTime;
    this.next = { minmin: t + 2, higurashi: t + rand(12, 30), tonbi: t + rand(20, 45), uguisu: t + rand(8, 20), furin: t + 1 };
    this.files.then(async (ab) => {
      await Promise.all(Object.entries(ab).map(async ([n, p]) => {
        try { this.buf[n] = await c.decodeAudioData(await p); } catch (e) { console.warn('町の音を開けない', n, e); }
      }));
      // ループ: 頭をばらばらにして、はじめは無音から
      for (const [k, n] of Object.entries(LOOPS)) {
        const b = this.buf[n];
        if (!b) continue;
        const s = c.createBufferSource(); s.buffer = b; s.loop = true;
        const g = c.createGain(); g.gain.value = 0;
        s.connect(g).connect(this.bus[LOOP_BUS[k]]);
        s.start(c.currentTime + 0.05, Math.random() * b.duration);
        this.loop[k] = { s, g };
      }
    });
  }

  // 1 回鳴らす。part: まとめたファイルの何番目か（省略でばらばらに、同じのが続かないように）
  play(name, { bus = 'sfx', gain = 1, pan = 0, rate = 1, part, lp = 0, when = 0 } = {}) {
    const c = this.ctx, b = this.buf[name];
    if (!c || !b || !this.on || this.vol[bus] < 0.01) return;
    const parts = this.man?.[name]?.parts;
    let off = 0, dur = b.duration;
    if (parts) {
      let i = part ?? Math.floor(Math.random() * parts.length);
      if (part == null && parts.length > 1 && i === this.last[name]) i = (i + 1) % parts.length;
      this.last[name] = i;
      [off, dur] = parts[i];
    }
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    let node = s;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node = node.connect(f); }
    const g = c.createGain(); g.gain.value = gain;
    node = node.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node = node.connect(p); }
    node.connect(this.bus[bus]);
    s.start(c.currentTime + when, off, dur);
  }

  // 足音。surface: soil / gravel / grass / sand / asphalt、run: 走っている
  step(surface = 'soil', run = false, k = 1) {
    const name = (run ? 'run-' : 'step-') + surface;
    this.play(this.buf[name] ? name : 'step-soil', { gain: (run ? 0.5 : 0.42) * k * rand(0.8, 1.05), rate: rand(0.93, 1.07) });
  }

  // 着地（ジャンプのあと）
  land(surface = 'soil') { this.play('run-' + surface, { gain: 0.65, rate: 0.86 }); }

  // 知らせの音: coin = お小遣いをもらった（ちゃりん）、give = 物をわたした、open = 持ち物を開いた
  chime(kind = 'coin') {
    if (kind === 'coin') this.play('coin', { gain: 0.7 });
    else if (kind === 'give') this.play('give', { gain: 0.55 });
    else this.play('bag', { gain: 0.6 });
  }

  // 会話の文字送り。1 文字ごとだとうるさいので間をあける
  blip() {
    if (!this.ctx || this.ctx.currentTime - this.blipT < 0.075) return;
    this.blipT = this.ctx.currentTime;
    this.play('blip', { gain: 0.16, rate: rand(0.96, 1.04) });
  }

  // sky: 空の高さ 0..1（町の音が遠のく）、rush: 飛ぶ速さ 0..1（風切り音）
  // water: 水路・川の近さ、paddy: 田んぼ、forest: 林、furin: 風鈴の近さ（0..1）。furinPan: 風鈴の向き（-1 左 .. 1 右）
  update(dt, { nearSea = 0, time = 0, sky = 0, rush = 0, water = 0, paddy = 0, forest = 0, furin = 0, furinPan = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, L = this.loop;
    // 空の上ではうるさくないよう、いちばん高いところで 30% まで絞る
    this.master.gain.setTargetAtTime(this.on ? 0.8 * this.vol.master * (1 - 0.7 * sky) : 0, t, 0.1);
    const low = 1 - sky * 0.85, ground = sky < 0.3;
    const set = (k, v, tc = 0.4) => L[k]?.g.gain.setTargetAtTime(v, t, tc);
    set('cicada', (0.34 + 0.16 * forest - 0.14 * nearSea + 0.04 * Math.sin(time * 0.13)) * low, sky > 0.02 ? 0.25 : 0.8);
    const swell = 0.5 + 0.5 * Math.sin(time * 0.21 + 1);
    set('waves', nearSea * (0.28 + 0.1 * swell) * low, 0.5);
    set('windSoft', sky * 0.28, 0.3);
    set('windRush', rush * 0.43, 0.15);
    L.windRush?.s.playbackRate.setTargetAtTime(0.9 + rush * 0.3, t, 0.2);
    set('creek', water * 0.5 * low, 0.5);
    set('frogs', paddy * 0.22 * low, 1.2);
    if (!ground) return;
    const N = this.next;
    // ミンミンゼミ: どこかで 1 匹ずつ。海のそばでは少なく
    if (t > N.minmin && this.vol.insects > 0.01) {
      this.play('minmin', { bus: 'insects', gain: rand(0.2, 0.42) * (1 - nearSea * 0.5), pan: rand(-0.8, 0.8), rate: rand(0.97, 1.03) });
      N.minmin = t + rand(5, 13) * (1 + nearSea);
    }
    // ヒグラシ: ときどき林の方から「カナカナ…」
    if (t > N.higurashi) {
      this.play('higurashi', { bus: 'insects', gain: rand(0.18, 0.3) * (0.55 + 0.45 * forest), pan: rand(-0.9, 0.9), rate: rand(0.98, 1.02) });
      N.higurashi = t + rand(35, 80) * (1.3 - forest * 0.5);
    }
    // トンビ: 空の高い所から、遠く
    if (t > N.tonbi) {
      this.play('tonbi', { bus: 'insects', gain: rand(0.12, 0.2), pan: rand(-0.7, 0.7), lp: 3200 });
      N.tonbi = t + rand(55, 120);
    }
    // ウグイス: 林のそばでだけ
    if (t > N.uguisu) {
      if (forest > 0.25) this.play('uguisu', { bus: 'insects', gain: rand(0.1, 0.18) * forest, pan: rand(-0.9, 0.9), lp: 6000 });
      N.uguisu = t + rand(25, 60);
    }
    // 風鈴: 店や家の軒先。風が吹いたときにだけ
    if (t > N.furin) {
      if (furin > 0.02) this.play('furin', { bus: 'env', gain: furin * rand(0.16, 0.3), pan: furinPan * 0.7, rate: rand(0.97, 1.03) });
      N.furin = t + rand(4, 11);
    }
  }
}
