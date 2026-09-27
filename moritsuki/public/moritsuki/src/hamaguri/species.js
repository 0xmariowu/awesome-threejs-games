// 南の浜で獲れるもの（図鑑・値段・料理・当たりの音・砂の中の深さ）
// size: 殻の長さ cm、depth: 殻の上の砂の厚さ m、sound: 当たったときの音（audio.js の contact）
export const SHELLS = {
  honhama: {
    id: 'honhama', name: '本ハマグリ', kanji: '蛤', en: 'Hard clam (Meretrix lusoria)', kind: 'clam', live: true, siphon: true,
    size: [4.5, 9], base: 340, at: 7, rarity: 3, sound: 'kachin', depth: [0.015, 0.06],
    desc: 'つやのある殻に、一つずつちがう模様。河口の細かい砂にすむ。近ごろはめっきり減った、浜の宝物。',
    hint: '西の河口のそば、砂が黒っぽくなっている干潟。', dish: '焼きハマグリ',
  },
  chosen: {
    id: 'chosen', name: 'チョウセンハマグリ', kanji: '朝鮮蛤', en: 'Meretrix lamarckii', kind: 'clam', live: true, siphon: true,
    size: [5.5, 11], base: 260, at: 8, rarity: 2, sound: 'katsun', depth: [0.02, 0.07],
    desc: '外海の波が立つ砂浜にすむ大型のハマグリ。殻が厚く、ずっしり重い。碁石の白はこの殻から作られた。',
    hint: '波の寄せる外浜の、ひざより深い所。深いほど大きい。', dish: 'ハマグリのお吸い物',
  },
  bakagai: {
    id: 'bakagai', name: 'バカガイ', kanji: '馬鹿貝', en: 'Mactra chinensis', kind: 'clam', live: true, siphon: true,
    size: [5, 8.5], base: 95, at: 7, rarity: 1, sound: 'kashi', depth: [0.01, 0.05],
    desc: '殻がうすく、赤い足を出したまま閉じないのが名の由来とも。身は「青柳」、貝柱は「小柱」。',
    hint: '浜のどこにでも。殻がうすいので音が軽い。', dish: '青柳の酢みそ和え',
  },
  nagarami: {
    id: 'nagarami', name: 'ナガラミ', kanji: '長螺', en: 'Umbonium giganteum', kind: 'snail', live: true, siphon: false, alias: 'ダンベイキサゴ',
    size: [2.4, 4], base: 28, at: 3, rarity: 1, sound: 'chi', depth: [0.004, 0.025],
    desc: '正しくはダンベイキサゴ。平たいこまのような巻き貝で、波打ち際の浅い砂に群れる。',
    hint: '浅い所に群れている。一つ当たればまわりにも。', dish: 'ナガラミの塩ゆで',
  },
  tsumeta: {
    id: 'tsumeta', name: 'ツメタガイ', kanji: '津免多貝', en: 'Glossaulax didyma', kind: 'moon', live: true, siphon: false,
    size: [4, 7.5], base: 70, at: 6, rarity: 2, sound: 'kochin', depth: [0.01, 0.05],
    desc: 'ほかの貝の殻に丸い穴をあけて食べる、ハマグリの天敵。砂の中を大きな足ではい回る。',
    hint: 'ハマグリのいる所の近く。穴のあいた空き殻が目印。', dish: 'ツメタガイの煮つけ',
  },
  // ── 伝説
  nushiHama: {
    id: 'nushiHama', name: 'ハマグリの主', kanji: '蛤之主', en: 'LEGEND', kind: 'clam', live: true, siphon: true, legend: true, model: 'honhama',
    size: [19, 23], base: 42000, at: 20, rarity: 5, sound: 'gon', depth: [0.03, 0.05],
    desc: '河口の干潟に何十年もすむという大ハマグリ。殻に刻まれた年輪は、浜の歴史そのもの。',
    hint: '河口の黒い砂の干潟、本ハマグリの群れの中。砂に大きな水管の穴があくという。', dish: '主の浜焼き',
  },
  nushiChosen: {
    id: 'nushiChosen', name: 'チョウセンハマグリの主', kanji: '朝鮮蛤之主', en: 'LEGEND', kind: 'clam', live: true, siphon: true, legend: true, model: 'chosen',
    size: [24, 28], base: 58000, at: 25, rarity: 5, sound: 'gon', depth: [0.035, 0.055],
    desc: '沖の瀬の手前、波の下にひそむ巨大なチョウセンハマグリ。潮が引ききった時だけ手が届く。',
    hint: '沖の瀬の手前の溝。潮が満ちると届かなくなる。', dish: '主の酒蒸し',
  },
  // ── ハズレ（図鑑には載らない）
  kara: { id: 'kara', name: '空き殻', kind: 'valve', junk: true, size: [4, 9], sound: 'chari', depth: [0.0, 0.04] },
  ishi: { id: 'ishi', name: '石', kind: 'stone', junk: true, size: [5, 14], sound: 'gotsu', depth: [0.0, 0.06] },
  ryuboku: { id: 'ryuboku', name: '流木', kind: 'wood', junk: true, size: [12, 30], sound: 'kotsu', depth: [0.0, 0.05] },
};

export const ZUKAN_IDS = ['honhama', 'chosen', 'bakagai', 'nagarami', 'tsumeta'];
export const LEGEND_IDS = ['nushiHama', 'nushiChosen'];

/** 値段: 大きさの 3 乗（重さ）に比例 */
export function valueOf(sp, cm) {
  if (sp.junk) return 0;
  return Math.max(10, Math.round((sp.base * Math.pow(cm / sp.at, 3)) / 10) * 10);
}
/** 重さ（g）の目安 */
export function weightOf(sp, cm) {
  const k = sp.kind === 'clam' ? (sp.id === 'bakagai' ? 0.15 : 0.22) : sp.kind === 'snail' ? 0.45 : 0.3;
  return Math.round(k * cm * cm * cm);
}

// 当たりの音をカタカナで（突いた所に出す）
export const SOUND_WORD = {
  kachin: 'カチン', katsun: 'カツン', kashi: 'カシッ', chi: 'チッ', kochin: 'コチン', gon: 'ゴン…ッ',
  chari: 'チャリ', gotsu: 'ゴツ', kotsu: 'コツ',
};

// 腕前（本日の成果の額で）
export const RANKS = [
  { min: 0, title: '砂遊び', sub: '次は、耳をすませて。' },
  { min: 500, title: '見習い', sub: 'カチンの音がわかってきた。' },
  { min: 2000, title: '浜の子', sub: '晩ごはんに、お吸い物が一品。' },
  { min: 5000, title: '突き上手', sub: '浜焼きができるほど獲れた。' },
  { min: 10000, title: 'ハマグリ名人', sub: '浜のおじさんも一目置く。' },
  { min: 25000, title: '浜の主', sub: '南の浜は、きみの庭だ。' },
];
