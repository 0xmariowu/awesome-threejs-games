# Punk engine audio

Threejs-Punk's unchanged sampled V8 and procedural V8 AudioWorklets, driven by a small standalone tachometer host. The original game is by **Anderson Mancini and Sunag**, https://www.threejspunk.com/.

## Run

```sh
node tools/server.mjs examples/punk-engine-audio
# http://127.0.0.1:8130/
```

No build, package installation, Three.js, or external requests are needed. AudioWorklet requires localhost or HTTPS and a browser gesture: click **Start audio**. The shared example frame supports `?lang=zh|en&theme=light|dark`, browser preference defaults, mobile width and embedding.

- Hold **W**, or move **Throttle**, to accelerate. Releasing W returns to the slider setting; set the slider to zero for full lift-off.
- **Q / E** and the gear buttons shift through six forward gears.
- **Drive sweep** accelerates through all six gears, coasts, and repeats.
- **Engine voice** switches between the original sampled engine and original procedural synth. The game normally uses the synth only if sample loading fails; this host exposes both for comparison.
- **Pause audio** suspends the audio context and releases the controls. Leaving the frame also clears throttle and automatic driving.

The instrument shows RPM, gear, turbo spool, operating state, load, output RMS, release count and limiter cuts. The waveform and RMS come from a real AnalyserNode. Neither original worklet sends layer weights or other telemetry; the host does not invent those readings.

## Original boundary and provenance

`original/` contains eight byte-identical files from `threejs-punk/public/`:

- `assets/engineSampler.worklet-CiauAed6.js` and `engineSynth.worklet-tkiTUezc.js`.
- `audio/engine/v8.json` and `v8.wav`.
- `audio/turbo/releases.json` and `releases.wav`.
- `audio/nitro-turbo.mp3` and `audio/tire-squeal.wav`, preserved as related source assets but not loaded by this engine-only host.

`provenance.json` records each source path, source URL, credit and SHA-256. The V8 JSON retains its recording-source URL. The turbo JSON retains the three Freesound contributors and CC0 notices. This example adds no blanket license for the upstream project or recordings.

The 2 MB `assets/index-*.js` bundle is **never imported, copied or evaluated**. Its hash is recorded as a read-only protocol reference. The relevant archived symbols are `Qk` (sample loading), `Qce` / `Ze` (audio graph and update), `I2` (defaults), `gh` (Quadra configuration) and `yde` (drivetrain).

All HTML, gauge drawing, input handling, drivetrain fixture and audio graph wiring in `src/` are new host code. `src/ui.js` and `ui.css` are byte-identical copies of `examples/_shared/`.

## Worklet protocol

The sampler registers `engine-sampler`; the synth registers `engine-synth`. Both have zero inputs and three k-rate AudioParams: `rpm` (0–12000), `load` (0–1), and `throttle` (0–1). The host creates stereo sampler output and mono synth output, as the original driver does.

The sampler receives one structured-clone message:

```js
{
  samples: decodedBuffer.getChannelData(0).slice(),
  sampleRate: decodedBuffer.sampleRate,
  times: bank.points.map(p => p[0]),
  freqs: bank.points.map(p => p[1]),
  gains: bank.points.map(p => p[2]),
  rpmPerHz: bank.rpmPerHz,
  cylinders: bank.cylinders ?? 8,
  rpmRange: [900, 7800]
}
```

The decoded sample rate is used because the browser may resample the WAV. The original sampler defaults match the game's unmodified V8 tuning. The optional live tuning protocol is `{type: 'tune', params: {...}}`; this host keeps the defaults. The synth needs no initialization message.

The original driver smooths RPM/load/throttle with `setTargetAtTime` constants of 0.012/0.03/0.02 seconds. Load is clamped from `soundLoad ?? load ?? throttle`. The worklet receives the driver's throttle, including during a torque cut. Gear has no separate AudioParam: it changes RPM and engine load before these updates.

The host preserves the eight-band EQ (45–5600 Hz, Q 2.05, +4.5/+8/+12.5 dB at 45/90/5600 Hz), engine gain `0.46 + load * 0.19`, synth gain factor 0.52, and compressor defaults. A separate host volume replaces the game's global, car-volume and positional routing.

## Fixture limits

The host uses Quadra's 900 RPM idle, 7600 RPM redline, 7800 RPM limiter, 50 ms limiter cut, 140 ms shift time, six gear ratios, torque curve and friction-based load formula. Acceleration, coast drag and instantaneous RPM ratio changes are a small demonstration fixture. There are no wheel, clutch, traction-control or chassis dynamics; it does not reproduce the game's driving physics. The automatic sweep shifts at 7350 RPM and includes a host-authored coast/reset phase.

Turbo spool and lift thresholds follow the original driver: normalized rev demand, 0.5 s spool-up / 0.9 s decay, throttle held above 0.6 for over 0.25 s, then below 0.2 with spool above 0.3. Release playback uses the original `long-a` and `long-b` takes, Quadra rates 0.72/0.68 and 25 ms twin delay, with a small host envelope. The game's additional procedural body, flutter, whistle and echo graph remains in the bootstrap bundle and is omitted. Nitro, tire squeal, road/wind noise, external backfire samples, spatial audio and environmental acoustics are also omitted. Worklet-generated overrun pops remain unchanged.

## Verify

```sh
node --test examples/punk-engine-audio/*.test.mjs && python3 examples/punk-engine-audio/test_browser.py
```

Node tests verify archived/copy hashes, exact original inventory, shared UI copies, bootstrap exclusion and fixture behavior. Browser tests own a server (8130 or an available port) and launch installed Chrome through Python Playwright. They use real clicks, keyboard and slider input; validate zh/en and light/dark; check actual worklet parameters and raw/mixed RMS during acceleration; detect nonzero turbo output on lift; exercise both voices, shifts, limiter, pause/resume, automatic driving, mobile and iframe focus loss. Page, console, HTTP and external-request errors fail the checks.

`window.__example` exposes read-only per-frame snapshots of the fixture, actual AudioParam values, raw RMS for both worklets, mixed output RMS, turbo RMS and processor errors. This verifies execution and signal changes, not a subjective listening comparison with the full game.

The requested desktop screenshot is saved to the task scratchpad's `shots/punk-engine-audio.png`; the mobile screenshot is saved beside it. Shared UI screenshots go to `output/examples/punk-engine-audio/` as required by the existing helper.
