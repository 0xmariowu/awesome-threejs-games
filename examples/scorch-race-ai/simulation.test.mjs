import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { select } from './build.mjs';
import { targetFor } from './src/targets.mjs';

const bytes = await readFile(new URL('./original/index.html', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./provenance.json', import.meta.url)));
function fixture() {
  let seed = 42;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const G = { t: 0, raceT: 0, phase: 'race' };
  const context = vm.createContext({ Math: math, URLSearchParams, location: { search: '' },
    window: {}, G, fx: { burst() {}, emit() {} }, AUDIO: {}, UI: {}, post: {} });
  vm.runInContext(select(bytes, manifest.vendor), context);
  vm.runInContext(manifest.blocks.map(b => select(bytes, b)).join('\n') + `
    globalThis.api = { Racer, POD_DEFS, racers, TRACK, TRACK_HALF, PINCHES,
      aiInput, stepRacer, collide, trackAt, trackQuery, pinchAt, hAt };
  `, context);
  const api = context.api;
  api.POD_DEFS.forEach((def, i) => {
    const r = new api.Racer({ def, exhausts: [] }, false); r.place(i); api.racers.push(r);
  });
  return { ...api, G, math };
}

test('markers match the actual atan2 target arguments inside unchanged aiInput', () => {
  const api = fixture(), r = api.racers[0], other = api.racers[1];
  for (const fraction of [0, 0.145, 0.385, 0.505, 0.745, 0.875]) {
    for (const speed of [0, 120, 320]) {
      const p = api.trackAt(fraction * api.TRACK.LEN);
      Object.assign(r, { x: p.x, z: p.z, th: Math.atan2(p.tx, p.tz), vf: speed,
        vx: p.tx * speed, vz: p.tz * speed, lane: 16, laneT: 10 });
      api.trackQuery(r.x, r.z, -1, r.Q);
      // A nearby rival exercises avoidance as well as the narrowing lane clamp.
      other.x = r.x + Math.sin(r.th) * 20 + Math.cos(r.th) * 2;
      other.z = r.z + Math.cos(r.th) * 20 - Math.sin(r.th) * 2;
      const calls = [];
      api.math.atan2 = (x, z) => { calls.push([x, z]); return Math.atan2(x, z); };
      api.aiInput(r, 1 / 120);
      const actual = calls[speed > 25 ? 1 : 0];
      const target = targetFor(r, api.racers, api);
      assert.ok(Math.abs(target.x - (r.x + actual[0])) < 1e-9);
      assert.ok(Math.abs(target.z - (r.z + actual[1])) < 1e-9);
      assert.notEqual(target.avoid, 0);
      const bounds = api.pinchAt(r.Q.s + target.look);
      assert.ok(target.lane >= bounds.lo + 7 && target.lane <= bounds.hi - 7);
    }
  }
});

test('six seeded original AIs complete multiple laps including every narrow section', () => {
  const api = fixture(), dt = 1 / 120;
  const start = api.racers.map(r => r.prog);
  let wallContacts = 0, maxStuck = 0, avoidanceSteps = 0, brakingSteps = 0, overtakes = 0;
  let previousOrder = api.racers.map((_, i) => i).join(',');
  const visited = api.racers.map(() => new Set());
  for (let frame = 0; frame < 150 * 120; frame++) {
    api.G.t += dt; api.G.raceT += dt;
    api.racers.forEach((r, i) => {
      const input = api.aiInput(r, dt);
      const target = targetFor(r, api.racers, api);
      if (target.avoid !== 0) avoidanceSteps++;
      if (input.brk > 0) brakingSteps++;
      api.stepRacer(r, dt, input);
      if (r.hitCool > 0.24) wallContacts++;
      maxStuck = Math.max(maxStuck, r.stuck);
      api.PINCHES.forEach((pinch, index) => {
        if (Math.abs(r.s - pinch.f * api.TRACK.LEN) < 20) visited[i].add(index);
      });
      assert.ok(Number.isFinite(r.x + r.z + r.vf));
    });
    api.collide();
    const order = api.racers.map((r, i) => ({ i, p: r.prog })).sort((a, b) => b.p - a.p).map(r => r.i).join(',');
    if (order !== previousOrder) overtakes++;
    previousOrder = order;
  }
  api.racers.forEach((r, i) => {
    assert.ok(r.prog - start[i] > 2 * api.TRACK.LEN, `pod ${i + 1}: two full laps`);
    assert.equal(visited[i].size, api.PINCHES.length);
  });
  assert.ok(avoidanceSteps > 100);
  assert.ok(brakingSteps > 100);
  assert.ok(overtakes > 0);
  assert.ok(maxStuck < 2.5, 'no stuck recovery required');
  console.log(JSON.stringify({ seconds: 150, wallContactSamples: wallContacts, maxStuck,
    avoidanceSteps, brakingSteps, orderChanges: overtakes,
    laps: api.racers.map((r, i) => +((r.prog - start[i]) / api.TRACK.LEN).toFixed(2)) }));
});
