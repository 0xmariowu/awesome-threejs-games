// 夜の内の浜で拾えるカニ（図鑑・値段・料理・挟む強さ）
// size: 甲羅の幅 cm（横の長いとげの先から先まで）、pinch: 挟まれやすさの倍率
export const CRABS = {
  taiwanM: {
    id: 'taiwanM', name: 'タイワンガザミ', sub: 'オス', kanji: '台湾蟹', en: 'Blue swimmer crab (Portunus pelagicus)', model: 'taiwan', sex: 'm',
    size: [11, 19], at: 15, base: 420, rarity: 1, pinch: 1, share: 0.46, wk: 0.066,
    desc: '青むらさきの地に、水色のまだら。夜になると浅瀬へ寄ってきて、砂にもぐって休む。いちばん後ろの脚はオールの形で、すいすい泳ぐ。',
    hint: '浅瀬の砂の中。いる所には、いたるところにいる。', dish: 'ワタリガニの塩ゆで',
  },
  taiwanF: {
    id: 'taiwanF', name: 'タイワンガザミ', sub: 'メス', kanji: '台湾蟹', en: 'Blue swimmer crab (Portunus pelagicus)', model: 'taiwan', sex: 'f',
    size: [10, 17], at: 14, base: 460, rarity: 1, pinch: 0.9, share: 0.42, wk: 0.07,
    desc: 'メスは緑がかった茶色で、オスより少し小さい。おなかのふたが丸くて幅が広い。内子がつまっていて、味はこちらが上という人も多い。',
    hint: 'オスと同じ所に、まじっている。', dish: 'ワタリガニのパスタ',
  },
  ishigani: {
    id: 'ishigani', name: 'イシガニ', sub: '', kanji: '石蟹', en: 'Charybdis japonica', model: 'ishi', sex: '',
    size: [6, 10.5], at: 8.5, base: 160, rarity: 2, pinch: 1.6, share: 0.12, wk: 0.15,
    desc: '小さいけれど、ハサミの力はこちらが上。暗いオリーブ色の甲羅に、むらさきがかったがっしりしたハサミ。石の多い所が好き。',
    hint: 'タイワンガザミにまじって、ときどき。挟まれると、とても痛い。', dish: 'イシガニの味噌汁',
  },
  // レジェンド: ガザミ（ワタリガニの仲間。イシガニも入れて）を合計 LEGEND_AT 匹拾うと、浜に現れはじめる。出会うのは 100 匹に 1 匹
  taraba: {
    id: 'taraba', name: 'タラバガニ', sub: '', kanji: '鱈場蟹', en: 'Red king crab (Paralithodes camtschaticus)', model: 'taraba', sex: '', legend: true,
    size: [20, 28], at: 24, base: 18000, rarity: 5, pinch: 1.3, share: 0, wk: 0.21,
    desc: '北の冷たい海の王さまが、なぜか内の浜の浅瀬に。カニの形をしているけれど、本当はヤドカリの仲間で、歩く脚は 3 対だけ（4 対目は甲羅の中に小さくしまってある）。体じゅうとげだらけで、右のハサミが大きい。',
    hint: '浅瀬のどこかに、ごくまれに（100 匹に 1 匹）。「いてっ」の輪郭が、とにかくでかい。', dish: 'タラバガニの焼きガニ',
  },
};

export const ZUKAN_IDS = ['taiwanM', 'taiwanF', 'ishigani', 'taraba'];
export const NORMAL_IDS = ['taiwanM', 'taiwanF', 'ishigani'];
export const LEGEND_AT = 100;     // レジェンドが現れはじめる、これまでに拾ったガザミの数
export const LEGEND_RATE = 0.006; // 砂の中のカニがタラバガニである割合（大きくて手に当たりやすいので、獲れるのが 100 匹に 1 匹ほどになるよう少なめ）
/** これまでに拾ったガザミ（レジェンドをのぞく）の数 */
export const gazamiTotal = (zukan) => NORMAL_IDS.reduce((n, id) => n + (zukan[id]?.caught || 0), 0);

/** 値段: 大きさの 3 乗（重さ）に比例 */
export function valueOf(sp, cm) {
  return Math.max(20, Math.round((sp.base * Math.pow(cm / sp.at, 3)) / 10) * 10);
}
/** 重さ（g）の目安 */
export function weightOf(sp, cm) { return Math.round(sp.wk * cm * cm * cm); }

// 砂の中の、カニでない硬いもの（手ざわりだけ。拾わない）
export const HARD = {
  ishi: { word: 'コツ', sound: 'stone' },
  kara: { word: 'ザリ', sound: 'shell' },
};

// 腕前（獲った数で）
export const RANKS = [
  { min: 0, title: '見物人', sub: '今夜は、浜の空気を吸いに来ただけ。' },
  { min: 5, title: 'カニ拾い見習い', sub: '「いてっ」の場所がわかってきた。' },
  { min: 20, title: 'カニ拾い', sub: 'クーラーボックスが重くなってきた。' },
  { min: 45, title: '浜の手だれ', sub: '砂をなでる手が、もう迷わない。' },
  { min: 80, title: 'ガザミ名人', sub: 'ご近所に配っても、まだ余る。' },
  { min: 130, title: 'ガザミ長者', sub: '今夜の内の浜は、きみのもの。' },
];
// タラバガニを獲った夜の腕前（数の腕前より上に出す）
export const LEGEND_RANK = { title: '浜の伝説', sub: 'タラバガニを、内の浜の浅瀬で拾った。だれも信じてくれない。' };
