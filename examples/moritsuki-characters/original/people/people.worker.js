// 登場人物のメッシュをワーカーで作る（距離関数の評価が重いので、町を作っている間に並行して）
import * as natsumi from './natsumi.js';
import * as isogai from './isogai.js';
import { transferables } from './human.js';

const CHARS = { natsumi, isogai };

self.onmessage = (e) => {
  const C = CHARS[e.data.id];
  const out = {};
  const bufs = [];
  for (const name of e.data.parts) {
    const m = C.buildPart(name);
    out[name] = m;
    bufs.push(...transferables(m));
    if (m.dir) bufs.push(m.dir.buffer);
  }
  self.postMessage(out, bufs);
};
