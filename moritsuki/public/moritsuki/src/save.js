// localStorage への保存（失敗しても遊べるように）
// 町から遊ぶとき（/mori/?town）は、日数・最高記録だけ町のセーブ（shared/progress.js）に分けて持つ。図鑑・設定・ヒントは共通
import { TOWN } from './townMode.js';
import { progress } from './shared/progress.js';

const KEY = 'moriIppon.save.v1';
const OWN = ['days', 'best', 'bestRank']; // 町モードでは別に数えるもの

const DEFAULTS = {
  settings: { sens: 1, fov: 74, master: 0.8, music: 0.55, sfx: 0.85, invertY: false, calm: false, quality: 'medium' },
  best: 0,
  bestRank: '',
  days: 0,
  zukan: {},
  hints: {},
};

const pick = (o) => Object.fromEntries(OWN.map((k) => [k, o[k]]));

export const save = {
  data: structuredClone(DEFAULTS),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = { ...structuredClone(DEFAULTS), ...d, settings: { ...DEFAULTS.settings, ...(d.settings || {}) } };
      }
    } catch (e) { /* 読めなくても続行 */ }
    if (TOWN) {
      // 元のゲームの日数・記録は取っておき、町モードのものに入れかえる
      this.own = pick(this.data);
      progress.load();
      Object.assign(this.data, pick(progress.data.mori));
    }
    return this.data;
  },
  write() {
    let d = this.data;
    if (TOWN) {
      progress.data.mori = pick(d);
      progress.write();
      d = { ...d, ...this.own };
    }
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* 保存できなくても続行 */ }
  },
  zk(id) {
    if (!this.data.zukan[id]) this.data.zukan[id] = { seen: false, caught: 0, best: 0 };
    return this.data.zukan[id];
  },
};
