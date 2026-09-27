import { tr } from './i18n.js';
import { Engine, GPU, G, FrameUniforms, Material, Texture, setFrameCamera } from '../original/engine/webgpu.js';
import { setShadowMap } from '../original/engine/render/wgsl/lighting.js';
import { Mesh, Group, PlaneGeometry, SphereGeometry, Vector3 } from '../original/engine/index.js';
import { OceanFFT } from '../original/ocean/OceanFFT.js';
import { WaterSurface } from '../original/ocean/WaterSurface.js';
import { WaterQuery } from '../original/ocean/WaterQuery.js';
import { BoatController } from '../original/player/BoatController.js';
import { BoatModel } from '../original/world/BoatModel.js';
import { buoyGeometry } from '../original/world/boat/DeckGear.js';
import { Input } from '../original/core/Input.js';

const status = document.querySelector('#status');
const seaControl = document.querySelector('#sea');
const helpersControl = document.querySelector('#helpers');
const slowControl = document.querySelector('#slow');

async function start() {
  const picture = document.querySelector('#world');
  const engine = new Engine(picture);
  // Adapt the original engine's window-sized output to this host's picture box.
  engine.resize = () => {
    const w = picture.clientWidth, h = picture.clientHeight;
    engine.canvas.width = Math.max(1, Math.floor(w * engine.renderScale));
    engine.canvas.height = Math.max(1, Math.floor(h * engine.renderScale));
    engine.canvas.style.width = `${w}px`;
    engine.canvas.style.height = `${h}px`;
    engine.camera.aspect = w / h;
    engine.camera.updateProjectionMatrix();
    FrameUniforms.fields.outputResolution.value.set(engine.width, engine.height);
    for (const notify of engine.onResize) notify(w, h);
  };
  await engine.init();
  new ResizeObserver(() => engine.resize()).observe(picture);
  // The original renderer always binds a shadow texture, even with shadows off.
  // Supply that global from the host; ShadowUniforms remains disabled by default.
  setShadowMap(new Texture({ width: 1, height: 1, dimension: '2d-array', format: 'depth32float', usage: ['sample', 'render'] }));
  engine.meshRenderer.syncPipelines = true;
  const { scene, camera } = engine;
  const input = new Input(engine.canvas);
  const fft = new OceanFFT(engine);
  // WaterQuery only needs the surface's original attenuation module and params.
  // Shore, wake and terrain are intentionally absent in this deep-water scene.
  const surface = new WaterSurface({ fft });
  const query = new WaterQuery(engine, surface);
  const model = new BoatModel();
  scene.add(model.group);
  const boat = new BoatController({ model, query, terrain: { heightAt: () => -500 } });
  boat.position.set(0, 0, 0);
  boat.moored = false;
  boat.driven = true;
  boat.apply();

  // A presentation material calls the ORIGINAL Eulerian height solver. No wave
  // equation, FFT, surface inversion or CPU approximation is implemented here.
  const waterMaterial = new Material({
    name: 'example-water', lit: false, side: 'double',
    modules: [query.heightModule],
    vertex: `
      let p = (v.model * vec4f(v.position, 1.0)).xz;
      v.useWorld = true;
      v.worldPos = vec3f(p.x, waterQueryHeightAtXZ(p), p.y);
      v.worldNormal = vec3f(0.0, 1.0, 0.0);
    `,
    surface: `
      var n = normalize(cross(dpdy(in.P), dpdx(in.P)));
      if (n.y < 0.0) { n = -n; }
      let fresnel = pow(1.0 - max(dot(n, in.V), 0.0), 4.0);
      let sky = mix(vec3f(0.39, 0.63, 0.69), vec3f(0.66, 0.80, 0.83), fresnel);
      let sun = pow(max(dot(reflect(-frame.sunDir, n), in.V), 0.0), 110.0);
      let diffuse = 0.5 + 0.5 * max(dot(n, frame.sunDir), 0.0);
      s.albedo = mix(vec3f(0.015, 0.19, 0.24) * diffuse, sky, 0.14 + fresnel * 0.72) + sun * vec3f(0.9, 0.76, 0.51);
    `,
  });
  const water = new Mesh(new PlaneGeometry(200, 200, 256, 256).rotateX(-Math.PI / 2), waterMaterial);
  water.frustumCulled = false;
  scene.add(water);

  const buoySlot = query.allocate('exampleBuoys', 5);
  const buoys = [[-8, -3], [-5, 7], [5, 5], [9, -2], [2, -8]].map(([x, z]) => {
    const group = new Group();
    for (const [geometry, options] of buoyGeometry()) group.add(new Mesh(geometry, new Material(options)));
    group.scale.setScalar(3);
    group.position.set(x, 0, z);
    scene.add(group);
    return group;
  });
  const markerMaterial = new Material({ color: 0xffc56c, lit: false, depthTest: false });
  const markers = boat.samples.map(() => {
    const marker = new Mesh(new SphereGeometry(0.09, 8, 6), markerMaterial);
    marker.renderOrder = 10;
    scene.add(marker);
    return marker;
  });

  // Deep-water fields from AppUI.js's Calm/Breezy/Choppy presets. The original
  // updateSpectrumUniforms() owns conversion and regenerates the GPU spectrum.
  const states = {
    calm: { wind: 3.5, fetch: 40, chop: 0.75, swell: 0.28 },
    breezy: { wind: 7, fetch: 120, chop: 0.9, swell: 0.48 },
    choppy: { wind: 12, fetch: 300, chop: 1.05, swell: 0.68 },
  };
  function changeSea() {
    const state = states[seaControl.value];
    fft.local.windSpeed = state.wind;
    fft.local.fetch = state.fetch;
    fft.swell.scale = state.swell;
    fft.choppiness.value = state.chop;
    fft.updateSpectrumUniforms();
    G.windSpeed.value = state.wind;
    seaControl.blur();
  }
  seaControl.addEventListener('change', changeSea);
  changeSea();
  let depth;
  function resizeDepth() {
    depth?.destroy();
    depth = GPU.device.createTexture({ size: [engine.width, engine.height], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
  }
  engine.onResize.push(resizeDepth);
  resizeDepth();
  let yaw = 0.6, pitch = 0.48, distance = 27;
  const up = new Vector3(0, 1, 0);
  let snapshot = null;
  Object.defineProperty(window, '__example', { get: () => snapshot });
  engine.start(realDt => {
    const dt = realDt * (slowControl.checked ? 0.2 : 1);
    GPU.beginFrame();
    FrameUniforms.fields.frameIndex.value = GPU.frame;
    G.dt.value = dt;
    G.time.value += dt;
    // Same input values as Player.js's boat mode, passed to the original solver.
    let throttle = input.down('KeyW') ? (input.down('ShiftLeft') ? 1 : 0.7) : 0;
    if (input.down('KeyS')) throttle = -0.6;
    const steer = Number(input.down('KeyA')) - Number(input.down('KeyD'));
    boat.setInput(throttle, steer, dt);
    boat.update(dt);
    model.update(dt);
    const look = input.consumeLook();
    yaw -= look.x * 0.005;
    pitch = Math.max(0.18, Math.min(1.1, pitch + look.y * 0.005));
    distance = Math.max(15, Math.min(55, distance + input.consumeWheel() * 2));
    camera.position.set(boat.position.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      2 + Math.sin(pitch) * distance, boat.position.z - Math.cos(yaw) * Math.cos(pitch) * distance);
    camera.lookAt(boat.position.x, 0.4, boat.position.z);
    water.position.set(boat.position.x, 0, boat.position.z);
    fft.update(dt);
    query.setCamera(camera.position.x, camera.position.z);
    boat.queueQueries();
    buoys.forEach((buoy, i) => query.setPoint(buoySlot + i, buoy.position.x, buoy.position.z));
    query.update();
    const buoyState = buoys.map((buoy, i) => {
      const result = query.get(buoySlot + i);
      if (query.cpuValid) {
        buoy.position.y = result.height - 0.18;
        const normal = new Vector3(result.nx, Math.sqrt(Math.max(0.01, 1 - result.nx ** 2 - result.nz ** 2)), result.nz).normalize();
        buoy.quaternion.setFromUnitVectors(up, normal);
      }
      return { x: buoy.position.x, z: buoy.position.z, y: buoy.position.y, height: result.height };
    });
    markers.forEach((marker, i) => {
      marker.visible = helpersControl.checked && query.cpuValid;
      const k = (boat.slot + i) * 4;
      marker.position.set(query.resultInputs[k], query.cpu[k] + 0.03, query.resultInputs[k + 1]);
    });
    setFrameCamera(camera, engine.width, engine.height);
    scene.updateMatrixWorld();
    engine.meshRenderer.render(scene, {
      kind: 'color', camera, colorFormats: [GPU.format], colorViews: [engine.currentTexture().createView()],
      clearColors: [[0.43, 0.64, 0.7, 1]], depthFormat: 'depth32float', depthView: depth.createView(), clearDepth: 0,
    });
    GPU.submit();
    input.endFrame();
    snapshot = {
      ready: query.cpuValid, frame: GPU.frame, time: G.time.value, seaState: seaControl.value,
      windSpeed: fft.local.windSpeed, spectrumPending: fft.needsSpectrum,
      timeScale: slowControl.checked ? 0.2 : 1, helpersVisible: helpersControl.checked,
      query: { version: query.version, resultTime: query.resultTime, latency: query.latency, count: query.count },
      boat: { position: boat.position.toArray(), yaw: boat.getYaw(), speed: boat.speed, throttle: boat.throttle,
        steer: boat.steer, hasWater: boat.hasWater, queryVersion: boat._qVersion, heights: Array.from(boat.waterH) },
      buoys: buoyState, camera: { yaw, pitch, distance },
    };
    if (GPU.frame % 15 === 0) status.textContent = tr({ zh: `风速 ${fft.local.windSpeed.toFixed(1)} 米/秒 · 船速 ${boat.speed.toFixed(1)} 米/秒\n水面高度 ${buoyState[0].height.toFixed(2)} 米 · 回读 ${Math.round(query.latency * 1000)} 毫秒`, en: `Wind ${fft.local.windSpeed.toFixed(1)} m/s · Boat speed ${boat.speed.toFixed(1)} m/s\nWater height ${buoyState[0].height.toFixed(2)} m · Readback ${Math.round(query.latency * 1000)} ms` });
  });
}

start().catch(error => {
  status.textContent = tr({ zh: `无法启动：${error.message}`, en: `Unable to start: ${error.message}` });
  console.error(error);
});
