// 夜の側溝で獲れるもの（図鑑・値段・料理・目の光り方・ふるまい）
// size: 全長 cm（カニは甲羅の幅）。eye: ライトを当てたときの目の反射（色・強さ）。ウナギ・ドジョウ・ナマズの目はほとんど光らない
// release: この大きさ未満は逃がす（cm）。alien: 外来種（逃がさない）
export const SPECIES = {
  unagi: {
    id: 'unagi', name: 'ニホンウナギ', kanji: '鰻', en: 'Japanese eel (Anguilla japonica)', body: 'eel',
    size: [22, 78], at: 55, base: 3200, rarity: 1, release: 30,
    eye: { col: [0.7, 0.8, 0.7], k: 0.06 },
    desc: '海で生まれ、川をさかのぼって田んぼの水路にまでやって来る。夜になると石や水草の陰から出てきて、エビや小魚を探して底を這い回る。環境省のレッドリストでは絶滅危惧種。',
    hint: '水草の陰・垂れた草の下・パイプの下。頭の向こうに網を入れて、手前に引け。', dish: '天然うなぎの蒲焼き',
  },
  suzuki: {
    id: 'suzuki', name: 'スズキ', kanji: '鱸', en: 'Japanese seabass (Lateolabrax japonicus)', body: 'bass', alias: 'セイゴ・フッコ',
    size: [24, 58], at: 45, base: 1500, rarity: 3,
    eye: { col: [1.0, 0.85, 0.55], k: 0.55 },
    desc: '海の魚だが、夜には川をさかのぼり、田んぼの水路の落ち込みで流れてくるエサを待ちぶせる。大きくなるにつれてセイゴ、フッコ、スズキと名前が変わる出世魚。',
    hint: '落ち込みの下のたまり。流れに頭を向けて止まっている。後ろからそっと。', dish: 'スズキの洗い',
  },
  mokuzu: {
    id: 'mokuzu', name: 'モクズガニ', kanji: '藻屑蟹', en: 'Japanese mitten crab (Eriocheir japonica)', body: 'crab', alias: 'ツガニ',
    size: [4.5, 9], at: 7, base: 700, rarity: 2,
    eye: { col: [0.95, 1.0, 0.55], k: 0.45 },
    desc: 'はさみに藻のような毛がふさふさ生えたカニ。秋には海へ下って卵を産む。ライトを当てると、はさみを振り上げて威張る。濃い味のだしが出る。',
    hint: '壁ぎわ・パイプの下・水門のまわり。はさみを上げていたら、すくいどき。', dish: 'ツガニ汁',
  },
  tenaga: {
    id: 'tenaga', name: 'テナガエビ', kanji: '手長海老', en: 'Oriental river prawn (Macrobrachium nipponense)', body: 'shrimp',
    size: [5, 11], at: 9, base: 90, rarity: 1,
    eye: { col: [1.0, 0.42, 0.12], k: 1.0 },
    desc: '体より長いはさみの腕を持つエビ。ライトを向けると、水の底で赤い目がいくつも光る。驚くと尾をたたんで後ろへはね飛ぶ。',
    hint: '底でオレンジに光る 2 つの点。はね飛ぶ先に網を。', dish: 'テナガエビの唐揚げ',
  },
  dojo: {
    id: 'dojo', name: 'ドジョウ', kanji: '泥鰌', en: 'Pond loach (Misgurnus anguillicaudatus)', body: 'loach',
    size: [8, 17], at: 13, base: 60, rarity: 1,
    eye: { col: [0.7, 0.75, 0.6], k: 0.05 },
    desc: '口にひげが 10 本。泥の上でじっとしていて、驚くとすぐ泥にもぐる。息つぎに水面へ上がってきて、お尻から泡を出すこともある。',
    hint: '泥のたまった所。もぐる前に、泥ごとすくえ。', dish: '柳川鍋',
  },
  namazu: {
    id: 'namazu', name: 'ナマズ', kanji: '鯰', en: 'Amur catfish (Silurus asotus)', body: 'catfish',
    size: [28, 58], at: 45, base: 1200, rarity: 3,
    eye: { col: [0.7, 0.72, 0.55], k: 0.07 },
    desc: '大きな口と長い 2 対のひげ。夜の水路をのっそり泳ぎ、口に入る物はなんでも食べる。ぬるぬるで重たい。',
    hint: 'クレソンや水草の下の暗がり、落ち込みのたまり。動きは遅い。', dish: 'ナマズの天ぷら',
  },
  zarigani: {
    id: 'zarigani', name: 'アメリカザリガニ', kanji: '蝲蛄', en: 'Red swamp crayfish (Procambarus clarkii)', body: 'crayfish', alien: true,
    size: [6, 12], at: 10, base: 40, rarity: 1,
    eye: { col: [1.0, 0.5, 0.2], k: 0.6 },
    desc: '昭和のはじめに食用ガエルのエサとして持ちこまれ、全国に広がった外来種。水草を切って田んぼや水路の生き物をへらしてしまう。つかまえたら逃がさない。',
    hint: '泥の上・水草の根元。赤いはさみが目印。', dish: 'ザリガニの塩ゆで',
  },
  // ── 伝説
  nushiUnagi: {
    id: 'nushiUnagi', name: 'ウナギの主', kanji: '鰻之主', en: 'LEGEND', body: 'eel', legend: true, model: 'unagi',
    size: [108, 124], at: 110, base: 60000, rarity: 5,
    eye: { col: [0.7, 0.8, 0.7], k: 0.1 },
    desc: '何十年もこの水路で生きてきたという大ウナギ。腕ほどの太さで、網に入れても力ずくで押し返してくる。',
    hint: '暗渠の奥か、上流の水門の下。', dish: '主の白焼き',
  },
  nushiSuzuki: {
    id: 'nushiSuzuki', name: 'スズキの主', kanji: '鱸之主', en: 'LEGEND', body: 'bass', legend: true, model: 'suzuki',
    size: [82, 94], at: 85, base: 45000, rarity: 5,
    eye: { col: [1.0, 0.85, 0.55], k: 0.8 },
    desc: '満ち潮にのって川をさかのぼってきた、ランカーサイズのスズキ。二つ目の落ち込みの下で、流れてくるエサを待っている。',
    hint: '二つ目の落ち込みの下。大きな金色の目が 2 つ。', dish: '主の塩焼き',
  },
};

export const ZUKAN_IDS = ['unagi', 'suzuki', 'mokuzu', 'tenaga', 'dojo', 'namazu', 'zarigani'];
export const LEGEND_IDS = ['nushiUnagi', 'nushiSuzuki'];

/** 重さ（g）の目安 */
export function weightOf(sp, cm) {
  switch (sp.body) {
    case 'eel': return Math.round(0.00085 * Math.pow(cm, 3.15));
    case 'bass': return Math.round(0.0115 * cm * cm * cm);
    case 'catfish': return Math.round(0.0075 * cm * cm * cm);
    case 'loach': return Math.round(0.006 * cm * cm * cm);
    case 'crab': return Math.round(0.34 * cm * cm * cm);
    case 'shrimp': return Math.round(0.012 * cm * cm * cm);
    case 'crayfish': return Math.round(0.022 * cm * cm * cm);
  }
  return 0;
}
/** 値段: 重さに比例（基準の大きさ at で base 円） */
export function valueOf(sp, cm) {
  const w = weightOf(sp, cm), w0 = weightOf(sp, sp.at);
  return Math.max(10, Math.round((sp.base * w) / w0 / 10) * 10);
}
/** スズキは大きさで名前が変わる（出世魚） */
export function nameOf(sp, cm) {
  if (sp.id === 'suzuki') return cm < 30 ? 'セイゴ' : cm < 60 ? 'フッコ' : 'スズキ';
  return sp.name;
}

// 腕前（本日の成果の額で）
export const RANKS = [
  { min: 0, title: '夜ふかし', sub: '次は、ライトの先の水草をよく見て。' },
  { min: 1500, title: '見習い', sub: '夜の水路の歩き方がわかってきた。' },
  { min: 5000, title: 'ウナギ獲り', sub: '明日の晩ごはんは、蒲焼きだ。' },
  { min: 12000, title: '水路の目', sub: '暗がりのどこにいるか、見えてきた。' },
  { min: 25000, title: 'ウナギ名人', sub: '集落のおじいさんも一目置く。' },
  { min: 50000, title: '水路の主', sub: '夜の側溝は、きみの庭だ。' },
];
