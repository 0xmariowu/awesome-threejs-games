// 水路の魚のテクスチャを塗るワーカー（起動時に種類ごとに並行して塗る）
import { FISH } from './fishspecies.js';
import { paintFishData } from './fishpaint.js';

self.onmessage = (ev) => {
  const { key, scale } = ev.data;
  const { data, W, H } = paintFishData(FISH[key], scale);
  self.postMessage({ key, data: data.buffer, W, H }, [data.buffer]);
};
