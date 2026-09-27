// 夜の外の浜で拾えるフグ（図鑑・大きさ・ひとこと）
// ・眼の光り方はどのフグも同じ。つかんで手の中に出てくるまで、どのフグかはわからない
// ・大きさは獲った時に見せるだけ（そのあとは区別しない）
// size: 全長 cm
export const FUGU = {
  kusa: {
    id: 'kusa', name: 'クサフグ', kanji: '草河豚', en: 'Grass puffer (Takifugu alboplumbeus)',
    size: [8, 17], rarity: 1,
    desc: '夜の波打ち際の砂にもぐって、眼だけを出して眠る小さなフグ。釣り人には餌取りとして嫌われるが、ライトで照らせば手ですくえるほどいる。',
    hint: '浅瀬の砂の中。赤く光る眼を探せ。',
    memo: '食べない（皮も身も、毒が強い）',
  },
  higan: {
    id: 'higan', name: 'ヒガンフグ', kanji: '彼岸河豚', en: 'Panther puffer (Takifugu pardalis)',
    size: [15, 28], rarity: 3,
    desc: '春の彼岸のころに浅場で卵を産むことから、この名に。黄土色の地に、こげ茶のまだらが網のようにつながる。クサフグの群れに、ときどき紛れこんでいる。',
    hint: 'クサフグにまじって、ごくたまに。光り方は同じ。',
    memo: '冬のてっちり（免許のある店で）',
  },
  shosai: {
    id: 'shosai', name: 'ショウサイフグ', kanji: '潮際河豚', en: 'Vermiculated puffer (Takifugu snyderi)',
    size: [16, 30], rarity: 3,
    desc: '名前のとおり潮際にも寄る、うすい砂色のフグ。肌はなめらかで、こまかい虫食いのような模様。クサフグより、のっぺりした顔つき。',
    hint: 'クサフグにまじって、ごくたまに。光り方は同じ。',
    memo: 'ひれ酒と一夜干し（免許のある店で）',
  },
  // 伝説: クサフグを合計 LEGEND_AT 匹獲ると、次の夜から砂にまじる。獲れるのは 50 匹に 1 匹
  tora: {
    id: 'tora', name: 'トラフグ', kanji: '虎河豚', en: 'Tiger puffer (Takifugu rubripes)', legend: true,
    size: [44, 66], rarity: 5,
    desc: 'フグの王様。ふだんは沖の潮通しのよい深場にすみ、高級料理店のいけすで見るような魚。それが、ひざ下の夜の浜で、手づかみで。……いるわけがない。いるわけがないのに、手の中で確かにふくらんでいる。博士に見せても、たぶん信じてもらえない。',
    hint: 'クサフグの浜に、なぜか。',
    memo: 'てっさ・てっちり（もちろん、免許のある店で）',
  },
};

export const ZUKAN_IDS = ['kusa', 'higan', 'shosai', 'tora'];
export const LEGEND_AT = 30;       // トラフグが砂にまじりはじめる、これまでに獲ったクサフグの数
export const RARE_RATE = 1 / 20;   // ヒガンフグとショウサイフグ（合わせて）
export const LEGEND_RATE = 1 / 50; // トラフグ（開放のあと）
export const BUCKET_MAX = 30;      // バケツがいっぱいになる数（どのフグも 1 匹）
/** これまでに獲ったクサフグの数 */
export const kusaTotal = (zukan) => zukan.kusa?.caught || 0;

/** 大きさ（cm）: 真ん中より少し小さめが多く、たまに大きいの */
export function rollSize(sp, r1, r2) {
  const u = r2 < 0.07 ? 0.82 + r1 * 0.18 : Math.pow(r1, 1.3) * 0.85;
  return Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * u) * 10) / 10;
}

// 石の光の正体（まちがえてつかんだ時に、手の中に出てくるもの）
export const DECOY = {
  chert: { name: '赤い小石', word: '石だった…', sub: '赤いチャートの小石。濡れると、つやつや光る' },
  glass: { name: 'ガラスのかけら', word: 'ガラスだった…', sub: '波にもまれて角のとれた、茶色いびんのかけら' },
  shell: { name: '貝殻のかけら', word: '貝殻だった…', sub: '内側がつやつやの、赤っぽい貝殻のかけら' },
};

// 腕前（獲った数と見分けの確かさで）
export const RANKS = [
  { min: 0, title: '見物人', sub: '今夜は、浜の空気を吸いに来ただけ。' },
  { min: 3, title: 'フグ拾い見習い', sub: '赤い光のうち、どれかは眼だった。' },
  { min: 10, title: 'フグ拾い', sub: 'バケツの中が、にぎやかになってきた。' },
  { min: 20, title: '浜の目きき', sub: '眼と石の光が、見分けられるようになってきた。' },
  { min: 30, title: 'クサフグ名人', sub: 'バケツがいっぱい。釣るより、ずっと早い。' },
];
// 見分けがほとんどまちがっていない夜（30 匹で、見分け 9 割以上）
export const SHARP_RANK = { title: 'フグの目', sub: '石には、ほとんど手を出さなかった。光を見ればわかる。' };
// トラフグを獲った夜の腕前
export const LEGEND_RANK = { title: '浜の伝説', sub: 'トラフグを、ひざ下の浅瀬で手づかみにした。だれも信じてくれない。' };
