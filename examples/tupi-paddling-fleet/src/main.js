import { setup, THREE, t, fail, readout } from './host.js';
import fleet from '../original/assets/fleet-CmCdPN8d.js';
import { i as fleetSpecs } from '../original/assets/layout-n7oYTSht.js';

async function start() {
  const {context: ctx, controls} = await setup([7, 3, 10], [0, 1, 0]);
  const count = document.querySelector('#count');
  const requested = Number(new URLSearchParams(location.search).get('canoes') || 3);
  count.value = String([1, 3, 6, 12].includes(requested) ? requested : 3);
  // The original fleet factory reads this exported layout once, including crew allocation.
  fleetSpecs.splice(Number(count.value));
  count.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('canoes', count.value);
    location.href = url.href;
  });
  const module = await fleet(ctx);
  ctx.scene.add(new THREE.AmbientLight(0xd5e4ef, 1.8));
  const ground = ctx.scene.getObjectByName('fleet:temp-water');
  ground.material.color.set(0x47626a);
  ground.material.roughness = .7;
  const rate = document.querySelector('#rate');
  const camera = document.querySelector('#camera');
  const pause = document.querySelector('#pause');
  let time = 45, previous = performance.now(), frames = 0;
  module.update(time, 0);
  const presets = {side: [10, 4, 2], top: [0, 18, .1], fleet: [48, 32, 28]};
  function preset() {
    const position = ctx.hero.object.position;
    controls.target.copy(position).add(new THREE.Vector3(0, camera.value === 'fleet' ? 0 : .7, camera.value === 'fleet' ? 28 : 0));
    ctx.camera.position.copy(position).add(new THREE.Vector3(...presets[camera.value]));
    if (camera.value === 'fleet' && ctx.canoes.length > 3) {
      const bounds = new THREE.Box3();
      for (const canoe of ctx.canoes) bounds.expandByPoint(canoe.object.position);
      bounds.getCenter(controls.target);
      const span = Math.max(60, bounds.getSize(new THREE.Vector3()).length());
      ctx.camera.position.copy(controls.target).add(new THREE.Vector3(span * .8, span * .53, 0));
    }
    controls.update();
  }
  preset();
  camera.addEventListener('change', preset);
  let lastHero = ctx.hero.object.position.clone();
  ctx.renderer.setAnimationLoop(now => {
    let dt = Math.min((now - previous) / 1000, .05); previous = now;
    dt = pause.checked ? 0 : dt * Number(rate.value);
    time += dt; ctx.time = time;
    module.update(time, dt);
    const delta = ctx.hero.object.position.clone().sub(lastHero);
    ctx.camera.position.add(delta); controls.target.add(delta);
    lastHero.copy(ctx.hero.object.position);
    controls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
    window.__example = {ready: ++frames > 5, frames, time, count: ctx.canoes.length,
      rate: Number(rate.value), phase: ctx.hero.strokePhase, period: ctx.hero.strokePeriod,
      hero: ctx.hero.object.position.toArray(), camera: ctx.camera.position.toArray(),
      preset: camera.value, stats: {...ctx.fleetStats}, backend: 'WebGPU'};
    readout(ctx.renderer, t({en: `${ctx.canoes.length} canoes · ${rate.value}× animation`, zh: `${ctx.canoes.length} 艘独木舟 · ${rate.value} 倍动画速度`}));
  });
}
start().catch(fail);
