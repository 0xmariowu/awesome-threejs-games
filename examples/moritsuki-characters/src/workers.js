// Observe native workers without changing their URLs, messages or original code.
const NativeWorker = window.Worker;
let current;
export function beginJob(id) {
  let cancelled = 0;
  if (current) for (const worker of [...current.workers]) { worker.terminate(); cancelled++; }
  current = { id, workers: new Set(), started: 0, completed: 0, bytes: 0, parts: {}, errors: [], hashes: [], cancelled };
  return current;
}
window.Worker = class extends NativeWorker {
  constructor(url, options) {
    super(url, options);
    const job = current;
    this.job = job;
    job.workers.add(this);
    job.started++;
    this.addEventListener('error', event => job.errors.push(event.message));
    this.addEventListener('message', event => {
      job.completed++;
      for (const [name, mesh] of Object.entries(event.data)) {
        const part = { vertices: mesh.pos.length / 3, triangles: mesh.idx.length / 3, hashes: {} };
        job.parts[name] = part;
        for (const [key, value] of Object.entries(mesh)) {
          if (!ArrayBuffer.isView(value)) continue;
          job.bytes += value.byteLength;
          // SHA-256 covers every byte of every returned attribute, not just a sample.
          job.hashes.push(crypto.subtle.digest('SHA-256', value).then(hash => {
            part.hashes[key] = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
          }));
        }
      }
    });
  }
  terminate() { this.job.workers.delete(this); super.terminate(); }
};
export function stopWorkers() {
  if (current) for (const worker of [...current.workers]) worker.terminate();
}
