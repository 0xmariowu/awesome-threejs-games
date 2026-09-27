// 主人公のメッシュをワーカーで作る（距離関数の評価が重いので、町を作っている間に並行して）
import { buildPart, transferables } from './shapes.js';

self.onmessage = (e) => {
  const out = {};
  const bufs = [];
  for (const name of e.data.parts) {
    const m = buildPart(name);
    out[name] = m;
    bufs.push(...transferables(m));
  }
  self.postMessage(out, bufs);
};
