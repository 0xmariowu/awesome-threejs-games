// 吉山の町の進みぐあい（町とミニゲームで共通のセーブ）。
// お小遣い・持ち物・頼まれごと・建物の段階・解放した遊び場・町から遊んだモリ突きの日数と記録。
// 銛一本を町から来ずに（/mori/）遊んだときは読み書きしない（町モード /mori/?town のときだけ）
const KEY = 'yoshiyama.save.v1';

const DEFAULTS = () => ({
  money: 0,                         // お小遣い（円）
  inv: {},                          // 持ち物 { id: 個数 }
  quests: {},                       // 頼まれごと { 人: { i: 何本目か, st: 'none' | 'asked' | 'done' | 'built' } }
  stages: { owner: 0, lab: 1 },     // 建物の段階（湊さんの家 0〜7、研究所 1〜10）
  unlocked: ['mori'],               // 遊べる場所
  mori: { days: 0, best: 0, bestRank: '' }, // 町から遊んだモリ突き（元のゲームの日数・記録とは別）
});

export const progress = {
  data: DEFAULTS(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw), def = DEFAULTS();
        this.data = { ...def, ...d, stages: { ...def.stages, ...(d.stages || {}) }, mori: { ...def.mori, ...(d.mori || {}) } };
      }
    } catch (e) { /* 読めなくても続行 */ }
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 保存できなくても続行 */ }
  },
  reset() { this.data = DEFAULTS(); this.write(); },

  // ---------- 持ち物 ----------
  count(id) { return this.data.inv[id] || 0; },
  add(id, n = 1) { this.data.inv[id] = this.count(id) + n; },
  // want = { id: 個数 } がそろっているか
  has(want) { return Object.entries(want).every(([id, n]) => this.count(id) >= n); },
  // そろっていれば持ち物から出す
  take(want) {
    if (!this.has(want)) return false;
    for (const [id, n] of Object.entries(want)) {
      this.data.inv[id] -= n;
      if (this.data.inv[id] <= 0) delete this.data.inv[id];
    }
    return true;
  },
  unlocked(spot) { return this.data.unlocked.includes(spot); },
  unlock(spot) { if (!this.unlocked(spot)) this.data.unlocked.push(spot); },
};
