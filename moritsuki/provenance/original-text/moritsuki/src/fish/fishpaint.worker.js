// 魚のテクスチャを塗るワーカー（起動時に魚種ごとに並行して塗る）
import { SPECIES, DECOR_FISH } from './species.js';
import { paintFishData } from './fishpaint.js';

self.onmessage = (ev) => {
  const { key, scale } = ev.data;
  const [g, k] = key.split(':');
  const sp = g === 'S' ? SPECIES[k] : DECOR_FISH[k];
  const { data, W, H } = paintFishData(sp, scale);
  self.postMessage({ key, data: data.buffer, W, H }, [data.buffer]);
};
