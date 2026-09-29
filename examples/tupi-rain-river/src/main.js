import { setup, THREE, t, fail, readout } from './host.js';
import environment from '../original/assets/environment-DsRXgLng.js';
import water from '../original/assets/water-Ct6j_3H2.js';
import { c as quality } from '../original/assets/layout-n7oYTSht.js';

async function start() {
  const {context: ctx, controls} = await setup([9, 3.5, 3], [0, 0, 30]);
  ctx.quality = quality.low;
  const atmosphere = await environment(ctx);
  const river = await water(ctx);
  const rain = document.querySelector('#rain');
  const mist = document.querySelector('#mist');
  const light = document.querySelector('#light');
  const pause = document.querySelector('#pause');
  // A few plain bank silhouettes provide scale and reflection contrast.
  // These are host geometry, not the archived terrain or forest.
  const bankMaterial = new THREE.MeshStandardNodeMaterial({color: 0x203329, roughness: 1});
  for (const side of [-1, 1]) for (let z = -60; z < 700; z += 30) {
    const bank = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), bankMaterial);
    bank.position.set(side * (38 + 4 * Math.sin(z / 90)), 1, z);
    bank.scale.set(15, 4 + 3 * Math.sin(z / 70) ** 2, 23);
    ctx.scene.add(bank);
  }
  let time = 0, previous = performance.now(), frames = 0;
  ctx.renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (!pause.checked) time += dt;
    ctx.time = time;
    controls.update();
    atmosphere.update(Number(light.value));
    const uniforms = ctx.atmosphere.uniforms;
    uniforms.time.value = time;
    uniforms.drift.value.set(time * .35, time * .6);
    uniforms.rain.value = Number(rain.value);
    uniforms.fogLow.value *= Number(mist.value);
    uniforms.mistSkin.value *= Number(mist.value);
    const drops = ctx.scene.getObjectByName('garoa');
    drops.visible = Number(rain.value) > 0;
    drops.count = Math.max(1, Math.round(5000 * Number(rain.value)));
    ctx.scene.getObjectByName('garoa-curtain').visible = false;
    river.update(time);
    ctx.renderer.render(ctx.scene, ctx.camera);
    window.__example = {ready: ++frames > 3, frames, time, rain: uniforms.rain.value,
      mist: Number(mist.value), fog: uniforms.fogLow.value, light: Number(light.value),
      camera: ctx.camera.position.toArray(), backend: 'WebGPU'};
    readout(ctx.renderer, t({en: 'Original water · rain ripples + mist', zh: '原始水面 · 雨滴涟漪和薄雾'}));
  });
}
start().catch(fail);
