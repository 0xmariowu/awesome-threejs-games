// ハマグリ突きのセーブ（localStorage。銛一本とは別のキー）
const KEY = 'hamaguriTsuki.save.v1';

const DEFAULTS = {
  settings: { sens: 1, fov: 72, master: 0.8, music: 0.5, sfx: 0.9, amb: 0.8, invertY: false, brim: true, quality: 'medium' },
  best: 0,
  bestRank: '',
  days: 0,       // 何回目の干潮か
  stabs: 0,      // これまでに突いた回数
  zukan: {},     // id → { caught, best(cm) }
  hints: {},
};

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
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 保存できなくても続行 */ }
  },
  zk(id) {
    if (!this.data.zukan[id]) this.data.zukan[id] = { caught: 0, best: 0 };
    return this.data.zukan[id];
  },
  reset() { this.data = structuredClone(DEFAULTS); this.write(); },
};
