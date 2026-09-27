// 持ち物の種類とジャンル（町の持ち物の画面・頼まれごとで使う）。
// モリ突きの獲物は fish/species.js から、ほかの遊びの物は ITEMS に足す（genre を GENRES から選ぶ）
import { SPECIES, PICKUPS, ZUKAN_IDS, LEGEND_IDS } from '../fish/species.js';
import { SHELLS, ZUKAN_IDS as SHELL_IDS, LEGEND_IDS as SHELL_LEGENDS } from '../hamaguri/species.js';
import { CRABS, ZUKAN_IDS as CRAB_IDS } from '../gazami/species.js';
import { FUGU, ZUKAN_IDS as FUGU_IDS } from '../kusafugu/species.js';
import { SPECIES as DITCH, ZUKAN_IDS as DITCH_IDS, LEGEND_IDS as DITCH_LEGENDS } from '../unagi/species.js';

// 持ち物の画面のタブ（この順に並ぶ）
export const GENRES = [
  { id: 'fish', name: '魚' },
  { id: 'shell', name: '貝・ウニ' },
  { id: 'crust', name: 'エビ・カニ・タコ' },
  { id: 'other', name: 'そのほか' },
];

// モリ突き以外の物: { id: { name, kanji?, desc, hint?, genre, unit, rarity, place: とれる所, icon?: 画像の URL } }
export const ITEMS = {};
// 蛤突き（南の浜）の貝。ハズレ（空き殻・石・流木）は持ち物に入らない。アイコンは town/bag.js が hamaguri/thumbs.js で描く
for (const id of [...SHELL_IDS, ...SHELL_LEGENDS]) {
  const s = SHELLS[id];
  ITEMS[id] = { name: s.name, kanji: s.kanji, desc: s.desc, hint: s.hint, genre: 'shell', unit: '個', rarity: s.rarity || 1, place: '南の浜', catch: true, from: 'hamaguri' };
}
// ガザミ拾い（夜の内の浜）のカニ。タイワンガザミはオス・メスで別の物
for (const id of CRAB_IDS) {
  const s = CRABS[id];
  ITEMS[id] = { name: s.name + (s.sub ? `（${s.sub}）` : ''), kanji: s.kanji, desc: s.desc, hint: s.hint, genre: 'crust', unit: '匹', rarity: s.rarity || 1, place: '内の浜', catch: true, from: 'gazami' };
}
// クサフグ拾い（夜の外の浜）のフグ
for (const id of FUGU_IDS) {
  const s = FUGU[id];
  ITEMS[id] = { name: s.name, kanji: s.kanji, desc: s.desc, hint: s.hint, genre: 'fish', unit: '匹', rarity: s.rarity || 1, place: '外の浜', catch: true, from: 'kusafugu' };
}
// 鰻掬い（夜の田んぼの側溝）の獲物。カニ・エビ・ザリガニは「エビ・カニ・タコ」へ
for (const id of [...DITCH_IDS, ...DITCH_LEGENDS]) {
  const s = DITCH[id], crust = ['crab', 'shrimp', 'crayfish'].includes(s.body);
  ITEMS[id] = { name: s.name, kanji: s.kanji, desc: s.desc, hint: s.hint, genre: crust ? 'crust' : 'fish', unit: s.body === 'shrimp' ? '尾' : '匹', rarity: s.rarity || 1, place: '田んぼの側溝', catch: true, from: 'unagi' };
}

// 獲物のジャンル: 貝・ウニは拾う物、タコ・イセエビは形のちがう生き物、ほかは魚
const genreOfCatch = (id) => (PICKUPS[id] ? 'shell' : SPECIES[id]?.model ? 'crust' : 'fish');

export function itemOf(id) {
  if (ITEMS[id]) return { id, ...ITEMS[id] };
  const e = SPECIES[id] || PICKUPS[id];
  if (!e) return { id, name: id, desc: '', genre: 'other' };
  // 魚は「匹」、貝・ウニは「個」、タコは「杯」、イセエビは「尾」
  const unit = PICKUPS[id] ? '個' : id === 'tako' ? '杯' : id === 'iseebi' ? '尾' : '匹';
  return { id, name: e.name, kanji: e.kanji, desc: e.desc, hint: e.hint, genre: genreOfCatch(id), unit, rarity: e.rarity || 1, catch: true };
}

// 図鑑の並び（モリ突きの図鑑と同じ順）。持ち物の画面の並べ順に使う
export const CATCH_ORDER = [...ZUKAN_IDS, ...LEGEND_IDS, ...SHELL_IDS, ...SHELL_LEGENDS, ...DITCH_IDS, ...DITCH_LEGENDS, ...FUGU_IDS, ...CRAB_IDS];
// 蛤突きの貝（アイコンを蛤突きの貝のモデルで描く物）
export const SHELL_ORDER = [...SHELL_IDS, ...SHELL_LEGENDS];
// ほかのミニゲームの物（アイコンをそれぞれの遊びのモデルで描く）
export const MINI_ORDER = { gazami: CRAB_IDS, kusafugu: FUGU_IDS, unagi: [...DITCH_IDS, ...DITCH_LEGENDS] };
