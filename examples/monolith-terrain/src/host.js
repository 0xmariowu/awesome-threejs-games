import { tr } from './i18n.js';
// Observe the native worker boundary; job payloads and returned buffers stay untouched.
const NativeWorker = window.Worker;
const pending = new Map();
const jobs = { submitted: 0, completed: 0, failed: 0, chunkCompleted: 0, workers: 0 };
let slowJobs = false;
window.Worker = class extends NativeWorker {
  constructor(url, options) {
    super(url, options);
    this.workerId = ++jobs.workers;
    this.addEventListener('message', event => {
      const key = `${this.workerId}:${event.data.id}`;
      const job = pending.get(key);
      if (job) {
        jobs.completed++;
        if (event.data.error) jobs.failed++;
        else if (job.type === 'chunk') jobs.chunkCompleted++;
        pending.delete(key);
      }
    });
  }
  postMessage(message, ...options) {
    jobs.submitted++;
    pending.set(`${this.workerId}:${message.id}`, { ...message, world: undefined, coarse: undefined });
    const send = () => super.postMessage(message, ...options);
    // Optional host delay makes real pending jobs visible; no synthetic results.
    if (slowJobs && message.type === 'chunk') setTimeout(send, 250);
    else send();
  }
};

async function boot() {
  const address = location.href;
  // The entry owns the original height/noise functions and has a supported module
  // whitelist. Configure that boot side effect instead of replacing its imports.
  history.replaceState(null, '', '?modules=terrain,controls&skip=post&q=medium&hour=15');
  try { await import('../original/index-DGqtqlWq.js'); }
  finally { history.replaceState(null, '', address); }
  const game = window.__MW;
  await new Promise((resolve, reject) => {
    const started = performance.now();
    function check() {
      if (game.errors.length) return reject(new Error(game.errors.join('\n')));
      if (game.ready) return resolve();
      if (performance.now() - started > 90000) return reject(new Error('Terrain initialization timed out'));
      requestAnimationFrame(check);
    }
    check();
  });
  const ctx = game.ctx;
  // The unchanged engine assumes a full window. Adapt only its presentation size.
  const picture = document.querySelector('[data-demo-picture]');
  const resizePicture = () => {
    ctx.renderer.setSize(picture.clientWidth, picture.clientHeight, false);
    ctx.camera.aspect = picture.clientWidth / picture.clientHeight;
    ctx.camera.updateProjectionMatrix();
  };
  addEventListener('resize', resizePicture);
  new ResizeObserver(resizePicture).observe(picture);
  resizePicture();
  const start = [850, ctx.heightAt(850, 1050) + 260, 1050];
  const look = [-200, 180, -1000];
  ctx.cam.teleport(start, look);
  ctx.cam.speed = 180;
  const batches = [];
  ctx.scene.traverse(object => { if (object.isBatchedMesh) batches.push(object); });
  const bounds = new game.THREE.Box3();
  const map = document.querySelector('#chunks').getContext('2d');
  const statsLine = document.querySelector('#status');
  document.querySelector('#wireframe').onclick = event => {
    ctx.terrain.material.wireframe = !ctx.terrain.material.wireframe;
    event.currentTarget.setAttribute('aria-pressed', String(ctx.terrain.material.wireframe));
    event.currentTarget.blur();
  };
  document.querySelector('#slow').onclick = event => {
    slowJobs = !slowJobs;
    event.currentTarget.setAttribute('aria-pressed', String(slowJobs));
    event.currentTarget.blur();
  };
  document.querySelector('#reset').onclick = event => {
    ctx.cam.setMode('fly');
    ctx.cam.teleport(start, look);
    event.currentTarget.blur();
  };
  window.__example = { ready: true, state: null };
  function inspect() {
    const position = ctx.camera.position;
    const tiles = [];
    // The original allocator reuses instances and never deletes them; enumerate
    // live instances with the archived Three.js public visibility/bounds APIs.
    for (const batch of batches) {
      for (let id = 0; id < batch.instanceCount; id++) {
        if (!batch.getVisibleAt(id)) continue;
        batch.getBoundingBoxAt(batch.getGeometryIdAt(id), bounds);
        tiles.push([bounds.min.x + 1, bounds.min.z + 1, bounds.max.x - bounds.min.x - 2]);
      }
    }
    map.clearRect(0, 0, 240, 240);
    const square = (x, z, size, color) => {
      map.strokeStyle = color;
      map.strokeRect(120 + (x - position.x) / 25, 120 + (z - position.z) / 25, size / 25, size / 25);
    };
    for (const [x, z, size] of tiles) square(x, z, size, '#e0e6cf99');
    for (const job of pending.values()) {
      if (job.type !== 'chunk') continue;
      const size = 36800 / 2 ** job.L;
      square(job.ix * size - 18400, job.iz * size - 18400, size, '#ffaf4c');
    }
    map.save();
    map.translate(120, 120);
    const direction = ctx.camera.getWorldDirection(new game.THREE.Vector3());
    map.rotate(Math.atan2(direction.x, -direction.z));
    map.fillStyle = '#fff';
    map.beginPath(); map.moveTo(0, -7); map.lineTo(4, 5); map.lineTo(-4, 5); map.closePath(); map.fill();
    map.restore();
    const terrain = ctx.terrain.stats();
    statsLine.textContent = tr({ zh: `${terrain.workers} 个线程 · ${tiles.length} 个分块 · ${pending.size} 个任务处理中`, en: `${terrain.workers} workers · ${tiles.length} chunks · ${pending.size} tasks pending` });
    window.__example.state = {
      frame: game.frame, position: position.toArray(), quaternion: ctx.camera.quaternion.toArray(),
      speed: ctx.cam.velocity.length(), mode: ctx.cam.mode,
      wireframe: ctx.terrain.material.wireframe, slowJobs,
      terrain, jobs: { ...jobs, pending: pending.size }, tiles,
      modules: Object.keys(game.modules), errors: [...game.errors],
    };
  }
  inspect();
  setInterval(inspect, 100);
}

boot().catch(error => {
  document.querySelector('#error').hidden = false;
  document.querySelector('#error').textContent = tr({ zh: "地形加载失败，请确认浏览器已启用 WebGL 2。", en: "Terrain failed to load. Check that WebGL 2 is enabled." });
  console.error(error);
});
