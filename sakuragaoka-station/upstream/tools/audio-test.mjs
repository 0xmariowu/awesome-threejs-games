// Headless test of the synthesized audio engine (src/core/audio.js) in Edge/Chrome via puppeteer-core.
// Starts its own static server on a random port. Hard timeouts: the process always exits.
// usage:
//   node tools/audio-test.mjs                 offline render of every sound (tools/audio-test.html, OfflineAudioContext):
//                                             per-sound RMS / active RMS / loudest 100 ms / peak / L-R, exceptions, checks.
//                                             Finishes in well under 60 s (hard kill at --timeout, default 55 s).
//     --only bell        only cases whose name contains "bell"        --png   spectrograms -> shots/audio/<nn>_<name>.png
//     --par 3            cases rendered concurrently                  --json  print the raw results as JSON
//   node tools/audio-test.mjs --live [--secs 8] [--t 22] [--cam "-12.8,-31.5,-8,3"] [--timeout 150]
//                                             loads the real scene in shot mode (time frozen at --t, crossing view),
//                                             calls window.__ctx.audio.start(), samples meter()/stats for --secs seconds of
//                                             the real (muted) AudioContext, fires every one-shot next to the camera and
//                                             reports window.__errors, page errors and console errors / audio warnings.
//   node tools/audio-test.mjs --live --play [--secs 22] [--t 14] [--fakevoice]
//                                             same, but in real-time play mode: clicks 始める (user gesture -> start()), so the
//                                             trains' timetable (brake, announcements, doors) and the crossing drive the engine.
// Exit code: 0 ok, 1 failures, 2 hard timeout.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : '1'; args[k] = v; } }
const LIVE = !!args.live;
const HARD = Number(args.timeout || (LIVE ? 150 : 55)) * 1000;
const T0 = Date.now();
let browser = null, server = null;
const hardTimer = setTimeout(() => {
  console.log(`HARD TIMEOUT after ${HARD / 1000} s — killing the browser`);
  try { browser && browser.process() && browser.process().kill('SIGKILL'); } catch (e) { /* */ }
  process.exit(2);
}, HARD);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const gpu = LIVE ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox'] : [];
browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: [...gpu, '--no-first-run', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1280,720',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
  protocolTimeout: HARD,
});
const logs = [];
let failed = false;
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
try {
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.type(), s = m.text(); if (t === 'error' || /^\[audio\]/.test(s) || (LIVE && /audio/i.test(s) && t === 'warn')) logs.push(`[console.${t}] ${s}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) logs.push(`[http ${r.status()}] ${r.url()}`); });
  await page.evaluateOnNewDocument((fake) => {   // never speak aloud during tests: record what would be spoken
    window.__speech = [];
    try {
      if (window.speechSynthesis) window.speechSynthesis.speak = (u) => window.__speech.push({ text: u.text, voice: u.voice && u.voice.name, volume: +Number(u.volume).toFixed(2) });
      if (fake && window.speechSynthesis) {   // --fakevoice: pretend a Japanese voice exists so the speech path runs headless
        window.speechSynthesis.getVoices = () => [{ name: 'Test English', lang: 'en-US' }, { name: 'Test Nanami (ja)', lang: 'ja-JP' }];
        window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.volume = 1; this.rate = 1; this.pitch = 1; this.lang = ''; this.voice = null; } };
      }
    } catch (e) { /* */ }
  }, !!args.fakevoice);

  if (!LIVE) {
    const q = new URLSearchParams({ par: String(args.par || 3) });
    if (args.only) q.set('only', args.only);
    if (args.png) q.set('png', '1');
    await page.goto(`http://127.0.0.1:${port}/tools/audio-test.html?${q}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction('window.__done === true', { timeout: HARD - 3000, polling: 250 });
    const res = await page.evaluate(() => window.__results), rel = await page.evaluate(() => window.__relations);
    const outDir = path.join(root, 'shots', 'audio');
    if (args.png) fs.mkdirSync(outDir, { recursive: true });
    console.log(`${pad('case', 56)} ${lpad('rms', 6)} ${lpad('active', 7)} ${lpad('max100', 7)} ${lpad('peak', 6)} ${lpad('L-R', 5)} ${lpad('ms', 5)}   (dBFS; active = 100 ms windows within 30 dB of the loudest)`);
    res.forEach((r, i) => {
      console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${pad(r.name, 51)} ${lpad(r.rmsDb ?? '-', 6)} ${lpad(r.activeDb ?? '-', 7)} ${lpad(r.maxWinDb ?? '-', 7)} ${lpad(r.peak ?? '-', 6)} ${lpad(r.lrDb ?? '-', 5)} ${lpad(r.ms ?? '-', 5)}`);
      const bad = (r.checks || []).filter((c) => !c[1]).map((c) => c[0]);
      if (bad.length) console.log('       failed checks:', bad.join(', '));
      if (r.period) console.log(`       rail-joint period ${r.period.toFixed(3)} s (expected ${(25 / r.speed).toFixed(3)} s)`);
      for (const e of r.errs || []) console.log('       ', e);
      if (r.png) fs.writeFileSync(path.join(outDir, `${String(i).padStart(2, '0')}_${r.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_+$/g, '').slice(0, 40)}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
      if (!r.ok) failed = true;
    });
    for (const r of rel) { console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${pad(r.name, 51)} ${r.detail}`); if (!r.ok) failed = true; }
    if (args.json) console.log(JSON.stringify(res.map(({ png, ...r }) => r), null, 1));
    console.log(`${failed ? 'RESULT: FAIL' : `RESULT: OK (${res.length} cases, ${rel.length} relations)`}  in ${((Date.now() - T0) / 1000).toFixed(1)} s`);
  } else {
    const PLAY = !!args.play, secs = Number(args.secs || (PLAY ? 22 : 8)), cam = String(args.cam || '-12.8,-31.5,-8,3');
    const q = PLAY ? new URLSearchParams({ t: String(args.t ?? 14), q: args.q || 'low', cam }) : new URLSearchParams({ shot: '1', w: '960', h: '540', t: String(args.t ?? 22), q: args.q || 'low', cam });
    await page.goto(`http://127.0.0.1:${port}/index.html?${q}`, { waitUntil: 'load', timeout: 60000 });
    if (PLAY) await page.waitForFunction(() => { const b = document.getElementById('go'); return b && !b.disabled; }, { timeout: HARD - 30000, polling: 250 });
    else await page.waitForFunction('window.__ready === true', { timeout: HARD - 20000, polling: 250 });
    const pre = await page.evaluate(() => (window.__errors || []).length);
    console.log(`scene ready in ${((Date.now() - T0) / 1000).toFixed(1)} s (module errors so far: ${pre}) — ${PLAY ? 'real-time play mode, clicking 始める' : 'shot mode (time frozen), calling audio.start()'}`);
    if (PLAY) { await page.click('#go'); await page.evaluate((c) => { const v = c.split(',').map(Number); window.__setCam(v[0], null, v[1], v[2], v[3]); }, cam); }
    const st0 = await page.evaluate((play) => { const a = window.__ctx.audio; if (!play) a.start(); return { ready: a.ready, state: a.stats.state }; }, PLAY);
    console.log('audio.start():', JSON.stringify(st0));
    const samples = [];
    for (let s = 0; s < secs; s++) {
      await new Promise((r) => setTimeout(r, 1000));
      const m = await page.evaluate(() => {
        const a = window.__ctx.audio; let pk = 0, ss = 0; for (let i = 0; i < 8; i++) { const x = a.meter(); pk = Math.max(pk, x.peak); ss += x.rms * x.rms; }
        const rail = window.__ctx.services.rail, cr = window.__ctx.services.crossing;
        return { ready: a.ready, rms: Math.sqrt(ss / 8), peak: pk, stats: a.stats, t: a.context ? +a.context.currentTime.toFixed(2) : 0, sim: +(window.__ctx.time || 0).toFixed(1), crossing: cr ? cr.active : null, trains: rail ? rail.trains.map((tr) => `${tr.id}:${tr.speed.toFixed(1)}m/s@${tr.x.toFixed(0)}`).join(' ') : '' };
      });
      samples.push(m);
      console.log(`${lpad(s + 1, 3)} s  sim ${lpad(m.sim, 5)}  ctx ${lpad(m.t, 6)}  rms ${lpad((20 * Math.log10(m.rms + 1e-9)).toFixed(1), 6)} dB  peak ${m.peak.toFixed(3)}  bell ${m.crossing}  ${m.trains}  ${JSON.stringify(m.stats)}`);
    }
    // every one-shot next to the camera (and far away), then a few more seconds
    const fired = await page.evaluate(async () => {
      const a = window.__ctx.audio, c = window.__ctx.camera.position, out = {};
      for (const n of [...a.names.oneShots, 'footstep']) { const r = a.play(n, { position: { x: c.x + 2, y: c.y, z: c.z - 3 }, text: n === 'announce' ? 'テスト放送です' : undefined }); out[n] = r ? 'playing' : (n === 'footstep' ? 'no-op' : 'null'); a.play(n, { position: { x: c.x + 900, y: 0, z: c.z } }); }
      return out;
    });
    console.log('one-shots:', JSON.stringify(fired));
    let pk = 0;
    for (let s = 0; s < 4; s++) { await new Promise((r) => setTimeout(r, 1000)); const m = await page.evaluate(() => { const a = window.__ctx.audio; let p = 0; for (let i = 0; i < 8; i++) p = Math.max(p, a.meter().peak); return { p, stats: a.stats }; }); pk = Math.max(pk, m.p); console.log(`  +${s + 1} s  peak ${m.p.toFixed(3)}  ${JSON.stringify(m.stats)}`); }
    const fin = await page.evaluate(() => ({ errors: window.__errors || [], speech: window.__speech, audioErr: !!window.__ctx.audio.__err }));
    console.log('speech calls (stubbed):', JSON.stringify(fin.speech));
    const audioErrs = fin.errors.filter((e) => /audio/i.test(e.module + e.message));
    if (fin.errors.length) { console.log('window.__errors:'); for (const e of fin.errors) console.log(` - [${e.module}] ${String(e.message).split('\n')[0]}`); }
    const audioLogs = logs.filter((l) => /audio/i.test(l));
    const ok = samples.every((m) => m.ready) && samples.some((m) => m.rms > 1e-4) && samples.every((m) => m.peak < 0.99) && pk < 0.99 && !audioErrs.length && !audioLogs.length && !fin.audioErr && fired.footstep === 'no-op';
    if (!ok) failed = true;
    console.log(`${ok ? 'RESULT: OK (live scene)' : 'RESULT: FAIL (live scene)'}  audio errors: ${audioErrs.length}, audio console messages: ${audioLogs.length}, other module errors: ${fin.errors.length - audioErrs.length}  in ${((Date.now() - T0) / 1000).toFixed(1)} s`);
  }
} catch (e) {
  console.log('AUDIO TEST FAILED:', e.message);
  failed = true;
} finally {
  if (logs.length) { console.log('PAGE LOGS:'); for (const l of [...new Set(logs)].slice(0, 40)) console.log(' ', l.slice(0, 300)); }
  clearTimeout(hardTimer);
  try { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]); } catch (e) { /* */ }
  try { browser.process() && browser.process().kill('SIGKILL'); } catch (e) { /* */ }
  server.close();
  process.exit(failed ? 1 : 0);
}
