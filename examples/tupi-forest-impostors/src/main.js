import { setup, THREE, t, fail, readout } from './host.js';
import environment from '../original/assets/environment-DsRXgLng.js';
import forest from '../original/assets/forest-ehp2HefA.js';
import { a as loadScans, r as makeImpostors, n as impostorSize, p as makeInstances,
  S as barkMaterial, T as leafMaterial, E as updateFlora } from '../original/assets/species-DQm89Ox5.js';
import { c as quality } from '../original/assets/layout-n7oYTSht.js';

async function start() {
  const {context: ctx, controls} = await setup([100, 48, -60], [0, 10, 70]);
  ctx.quality = quality.low;
  const atmosphere = await environment(ctx);
  const original = await forest(ctx);
  const originalGroup = ctx.flora.forest.group;
  originalGroup.visible = false;
  const scans = await loadScans();
  const grove = new THREE.Group(); ctx.scene.add(grove);
  const bark = barkMaterial({color: 0x3a332c, wet: 0x2a241e, tideLine: -50, amp: .02, pale: .12});
  const leaf = leafMaterial(scans.atlas, {tint: [1,1,1], roughness: .85, translucency: .12, amp: .06, macro: .2, specular: false, deep: true});
  const batches = [];
  // Identical species, positions, rotations and heights for both representations.
  // Rows are separate draw batches so the host can cull by distance or select LOD.
  for (let row = 0; row < 8; row++) {
    const cardList = [], meshes = new THREE.Group();
    for (let variant = 0; variant < scans.variants.length; variant++) {
      const tree = scans.variants[variant], list = [];
      for (let column = 0; column < 5; column++) {
        const x = (column - 2) * 26 + variant * 7 - 7;
        const z = row * 48 + Math.sin(column * 4 + variant) * 9;
        const scale = .85 + .2 * Math.sin(column + row + variant) ** 2;
        const yaw = column * 2.3 + row + variant;
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
        list.push({matrix, color: [1,1,1]});
        cardList.push({x, y: 0, z, yaw, ...impostorSize(tree, tree.height * scale), row: tree.impostorRow, color: [1,1,1]});
      }
      meshes.add(makeInstances(tree.wood[0], bark, list, {name: `grove-${row}-${variant}-wood`}),
        makeInstances(tree.leaves[0], leaf, list, {name: `grove-${row}-${variant}-leaves`}));
    }
    const cards = makeImpostors(scans, cardList, {name: `grove-${row}-impostors`, tint: [1,1,1]});
    grove.add(meshes, cards);
    batches.push({meshes, cards, center: new THREE.Vector3(0, 0, row * 48)});
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI/2),
    new THREE.MeshStandardNodeMaterial({color: 0x48513d, roughness: 1}));
  ground.position.y = -.1; ctx.scene.add(ground);
  const mode = document.querySelector('#mode'), distance = document.querySelector('#distance');
  const scene = document.querySelector('#scene'), pause = document.querySelector('#pause');
  scene.addEventListener('change', () => {
    const full = scene.value === 'forest';
    originalGroup.visible = full; grove.visible = !full; mode.disabled = full;
    controls.target.set(...(full ? [0, 15, 230] : [0, 10, 70]));
    ctx.camera.position.set(...(full ? [0, 60, 80] : [100, 48, -60])); controls.update();
  });
  // Start in the original film's forest chapter, after the dark rainy opening.
  const filmStart = 104;
  // The isolated flat-ground fixture has no film auto-exposure. Supply diffuse
  // sky fill so the original dark Lambert atlases retain readable olive detail.
  ctx.scene.add(new THREE.AmbientLight(0xffffff, 8));
  let time = 0, previous = performance.now(), frames = 0;
  ctx.renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous)/1000, .05); previous = now;
    if (!pause.checked) time += dt;
    ctx.time = filmStart + time; controls.update(); atmosphere.update(ctx.time); original.update(time); updateFlora(ctx, time);
    ctx.camera.far = Number(distance.value); ctx.camera.updateProjectionMatrix();
    let cardRows = 0, meshRows = 0;
    for (const batch of batches) {
      const d = ctx.camera.position.distanceTo(batch.center);
      const visible = d < Number(distance.value);
      const cards = mode.value === 'cards' || (mode.value === 'auto' && d > 180);
      batch.cards.visible = visible && cards;
      batch.meshes.visible = visible && !cards;
      cardRows += Number(batch.cards.visible); meshRows += Number(batch.meshes.visible);
    }
    ctx.renderer.render(ctx.scene, ctx.camera);
    window.__example = {ready: ++frames > 3, frames, time, mode: mode.value, scene: scene.value,
      distance: Number(distance.value), cardRows, meshRows, trees: 120,
      triangles: ctx.renderer.info.render.triangles, draws: ctx.renderer.info.render.drawCalls,
      camera: ctx.camera.position.toArray(), backend: 'WebGPU'};
    readout(ctx.renderer, scene.value === 'forest'
      ? t({en: 'Original forest · fixed path-distance LOD', zh: '原始森林 · 沿路径距离分档'})
      : t({en: `${cardRows} card rows · ${meshRows} mesh rows`, zh: `${cardRows} 排卡片 · ${meshRows} 排网格`}));
  });
}
start().catch(fail);
