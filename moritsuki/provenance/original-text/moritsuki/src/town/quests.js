// 頼まれごと: 町の人が「最後の物」（魚など）をほしがる → 持ってきてわたす → 離れているあいだに建物が建て替わる →
// 次に話すと「もうかって建てた」話とお小遣い（子ども向けにケチな額）→ その次に話すと次の頼みごと。
// 磯貝博士は研究所（1〜10）、夏海は湊さんの家（0〜7）が大きくなる。いまはモリ突きの獲物だけ。ほかの遊びの物はあとで差しかえる
// せりふの書き方は people/lines.js と同じ（{ t, mood, g, pose }）
import { itemOf } from '../shared/items.js';

// アヒル島への行き方（最初の頼みごとで教える）
const TRAVEL_HINT = { t: 'アヒル島へは、F で空に上がって、島の青い印をえらべば行けるよ。', mood: 'normal', g: 'point' };

export const QUESTS = {
  // ---------- 磯貝博士（水産研究所: 1 浜の分室 → 10 王冠の本館）----------
  isogai: {
    site: 'lab',
    list: [
      {
        want: { uni: 5 }, reward: 800,
        ask: [
          { t: 'じつはね、いまウニの研究をはじめたところなんだ。', mood: 'normal', pose: 'lecture' },
          { t: 'ウニのトゲは、折れてもまた生えてくる。その仕組みがわかれば……', mood: 'think', pose: 'chin' },
          { t: '折れた骨を治す薬が作れるかもしれないんだよ！', mood: 'happy', g: 'point' },
          { t: 'そこでだ。ムラサキウニを5個、とってきてくれないかね？', mood: 'smile' },
        ],
        where: [
          { t: 'アヒル島の浅い岩の上に、黒いトゲトゲがいるはずだ。', mood: 'normal', pose: 'lecture' },
          { t: '潜って近づいたら、E で拾える。トゲには気をつけるんだよ。', mood: 'smile', g: 'glasses' },
        ],
        thanks: [
          { t: 'おお、ムラサキウニ！　しかも5個も！', mood: 'surprise' },
          { t: 'トゲの一本一本が、じつに美しい……', mood: 'happy', g: 'glasses' },
          { t: 'さっそく研究にとりかかるよ。ありがとう！', mood: 'smile', g: 'nod' },
        ],
        built: [
          { t: 'やあ、よく来たね！　見てくれたまえ、この建物を！', mood: 'happy', g: 'point' },
          { t: 'あのウニの研究が大当たりしてね。骨の薬の特許が、高く売れたんだ。', mood: 'smile', pose: 'lecture' },
          { t: 'その特許の収入で、研究所を2階建てに建てかえたというわけさ。', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { kasago: 3 }, reward: 500,
        ask: [
          { t: 'カサゴのヒレのトゲには、毒があるのを知っているかね？', mood: 'normal', pose: 'lecture' },
          { t: 'ところがこの毒、うすめると、痛みを止める薬になるらしい。', mood: 'think', pose: 'chin' },
          { t: 'カサゴを3匹、たのめるかな。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'カサゴは岩の上でじっとしている。岩そっくりの色だから、よく見ないとわからないよ。', mood: 'normal', pose: 'lecture' },
          { t: '動かないぶん、ねらいやすい。頭を突くんだ。', mood: 'smile', g: 'point' },
        ],
        thanks: [
          { t: 'カサゴ3匹、たしかに。', mood: 'smile', g: 'nod' },
          { t: 'この目つき、この面がまえ……たまらんね。', mood: 'happy', g: 'glasses' },
        ],
        built: [
          { t: 'きみのカサゴのおかげで、痛み止めの特許がとれてね。', mood: 'happy', pose: 'lecture' },
          { t: 'がっぽり……いや、それなりにもうかったので、3階建てにしたよ。', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { utsubo: 2 }, reward: 1000,
        ask: [
          { t: 'つぎはウツボだ。', mood: 'normal', g: 'glasses' },
          { t: 'ウツボの体のぬるぬるには、ばい菌をよせつけない力がある。', mood: 'normal', pose: 'lecture' },
          { t: 'これをぬれば、手術の道具をずっと清潔にしておけるかもしれない。', mood: 'think', pose: 'chin' },
          { t: 'ウツボを2匹、とってきてくれるかね。かまれないようにね。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'ウツボは大きな岩の根元の穴にひそんでいる。', mood: 'normal', pose: 'lecture' },
          { t: '顔だけ出しているところを、正面から突くといい。', mood: 'smile', g: 'point' },
        ],
        thanks: [
          { t: 'うわっ、ウツボ！　……いや、たのんだのはわたしだったね。', mood: 'surprise' },
          { t: 'このぬるぬる、すばらしい。ありがとう！', mood: 'happy', g: 'nod' },
        ],
        built: [
          { t: 'ウツボのぬるぬるコーティングが、世界中の病院に売れてね。', mood: 'happy', pose: 'lecture' },
          { t: '見てのとおり、タイル張りの4階建てさ。', mood: 'laugh', g: 'point' },
          { t: '研究員も3人やとえた。もう、わたし一人じゃないんだ。', mood: 'smile', g: 'glasses' },
        ],
      },
      {
        want: { tako: 2 }, reward: 700,
        ask: [
          { t: 'タコの吸盤を知っているかね。', mood: 'normal', pose: 'lecture' },
          { t: 'ぬれた岩にも、ガラスにも、ぴたりとくっつく。', mood: 'think', pose: 'chin' },
          { t: 'この仕組みで、何度でもはがせるテープを作りたいんだ。タコを2杯、たのむよ。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'タコも岩の根元の穴にいる。', mood: 'normal', pose: 'lecture' },
          { t: 'すみを吐いて逃げるから、見つけたらすかさず突くんだ。', mood: 'smile', g: 'point' },
        ],
        thanks: [
          { t: 'タコ2杯！　吸盤がまだ吸いついてくる……生命の神秘だね。', mood: 'happy', g: 'glasses' },
        ],
        built: [
          { t: '吸盤テープが大ヒットしてね。冷蔵庫にメモを貼るのにぴったりなんだ。', mood: 'happy', pose: 'lecture' },
          { t: 'おかげで5階建てさ。階段のガラスもしゃれているだろう？', mood: 'laugh', g: 'point' },
        ],
      },
      {
        want: { hirame: 2 }, reward: 1200,
        ask: [
          { t: '前に話したね。ヒラメの目は、どうして左に寄るのか。', mood: 'normal', g: 'glasses' },
          { t: 'いよいよ本気で調べることにした。', mood: 'think', pose: 'chin' },
          { t: '体の中で目が動く仕組みがわかれば、けがを治す医学が変わるかもしれない。', mood: 'normal', pose: 'lecture' },
          { t: 'ヒラメを2匹、とってきてくれたまえ。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'ヒラメは砂地の底に、砂をかぶってかくれている。', mood: 'normal', pose: 'lecture' },
          { t: '目だけ出しているから、砂の上をよーく見るんだ。', mood: 'smile', g: 'glasses' },
        ],
        thanks: [
          { t: 'ヒラメ2匹……たしかに目が左に寄っている。すばらしい！', mood: 'happy', g: 'glasses' },
        ],
        built: [
          { t: 'ヒラメの研究で、世界的な賞をもらってしまってね。', mood: 'happy', pose: 'lecture' },
          { t: '賞金と特許で、ガラス張りの本館と実験棟を建てたんだ。', mood: 'laugh', g: 'laugh' },
          { t: 'どうだい、もう「研究所」というより「研究センター」だろう？', mood: 'smile', g: 'point' },
        ],
      },
      {
        want: { ishidai: 3 }, reward: 600,
        ask: [
          { t: 'イシダイの歯を見たことがあるかね？', mood: 'normal', pose: 'lecture' },
          { t: 'サザエのからもかみくだく、とんでもなく丈夫な歯なんだ。', mood: 'surprise' },
          { t: 'この歯のつくりを調べて、一生もつ入れ歯を作りたい。イシダイを3匹たのむよ。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'イシダイは、水深10メートルより深い岩場にいる。', mood: 'normal', pose: 'lecture' },
          { t: '好奇心が強いから、海の底でじっと待っていると、向こうから寄ってくるよ。', mood: 'smile', g: 'glasses' },
        ],
        thanks: [
          { t: 'このしま模様……まちがいなくイシダイだ。', mood: 'happy', g: 'glasses' },
          { t: '深く潜ったんだね。えらいぞ。', mood: 'smile', g: 'nod' },
        ],
        built: [
          { t: '一生もつ入れ歯が、おじいちゃんおばあちゃんに大人気でね。', mood: 'happy', pose: 'lecture' },
          { t: 'もうかったので、実験棟を高くして、渡り廊下もつけたんだ。', mood: 'laugh', g: 'point' },
        ],
      },
      {
        want: { iseebi: 2 }, reward: 1500,
        ask: [
          { t: 'イセエビのからは、軽くて、かたくて、しなやかだ。', mood: 'normal', pose: 'lecture' },
          { t: 'このからの成分で、割れない自転車のヘルメットを作れないかと思ってね。', mood: 'think', pose: 'chin' },
          { t: 'イセエビを2尾、とってきてくれないか。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'イセエビは岩の穴の奥に、長いひげだけ出している。', mood: 'normal', pose: 'lecture' },
          { t: 'ひげが見えたら、その奥をねらうんだ。', mood: 'smile', g: 'point' },
        ],
        thanks: [
          { t: 'イセエビ！　……こんな立派なのを2尾も。', mood: 'surprise' },
          { t: '研究のあとで、夏海くんのところで味噌汁にしてもらおうかな。', mood: 'happy', g: 'glasses' },
        ],
        built: [
          { t: 'エビがらヘルメットが、世界中の自転車レースで使われることになってね。', mood: 'happy', pose: 'lecture' },
          { t: 'もうかりすぎて、実験棟がまた高くなってしまったよ。', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { awabi: 3 }, reward: 1000,
        ask: [
          { t: 'アワビのからの内側、虹色に光っているだろう？', mood: 'normal', pose: 'lecture' },
          { t: 'あれは真珠層といって、とても割れにくいつくりなんだ。', mood: 'think', pose: 'chin' },
          { t: 'これをまねて、割れないスマホの画面を作る。アワビを3個、たのむよ。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'アワビは岩の横の面にへばりついている。少し深めの所に多い。', mood: 'normal', pose: 'lecture' },
          { t: '見つけたら E ではがして拾うんだ。めったにないから、根気よくね。', mood: 'smile', g: 'glasses' },
        ],
        thanks: [
          { t: 'アワビが3個……！　この海の宝石を、よくぞ。', mood: 'surprise' },
          { t: 'きみは本当に、たよりになるね。', mood: 'smile', g: 'nod' },
        ],
        built: [
          { t: '割れない画面の特許が、とんでもない額で売れてね。', mood: 'happy', pose: 'lecture' },
          { t: 'それで、実験棟を8階建てにした。もうエレベーターなしでは暮らせないよ。', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { kue: 1 }, reward: 1000,
        ask: [
          { t: 'いよいよ、最後の研究だ。', mood: 'normal', g: 'glasses' },
          { t: 'アヒル島の洞窟には、この海のヌシ、クエがいるという。', mood: 'think', pose: 'chin' },
          { t: '百年生きるともいわれる魚だ。その長生きの秘密を知りたい。', mood: 'normal', pose: 'lecture' },
          { t: 'クエを1匹……たのめるかね。きみにしか、たのめないんだ。', mood: 'smile', g: 'point' },
        ],
        where: [
          { t: 'クエは、島の沖の崖の下にある、岩のアーチの洞窟にいる。', mood: 'normal', pose: 'lecture' },
          { t: '突いたら暴れるから、左クリックを連打して引き寄せるんだ。', mood: 'smile', g: 'point' },
        ],
        thanks: [
          { t: 'これが……クエ……！', mood: 'surprise' },
          { t: 'きみは本当に、すごい子だね。', mood: 'happy', g: 'nod' },
        ],
        built: [
          { t: 'クエの長生きの研究で、ノーベル賞の候補になってしまってね。', mood: 'happy', pose: 'lecture' },
          { t: '研究所は、ごらんのとおり。屋上に王冠までついてしまった。', mood: 'laugh', g: 'laugh' },
          { t: 'はじめて会ったときは、浜の小屋だったのにね。', mood: 'smile', g: 'glasses' },
          { t: 'きみのおかげだ。本当にありがとう。これは、特別ボーナスだ。', mood: 'happy', g: 'nod' },
        ],
      },
    ],
    // 頼みごとを受けたとき
    ok: [{ t: 'たのもしいね！　待っているよ。', mood: 'happy', g: 'nod' }],
    // 持ってきた物がそろっているとき
    ready: [{ t: 'む、そのバケツの中身は……！', mood: 'surprise' }],
    later: [{ t: 'そうかね。では、待っているよ。', mood: 'smile', g: 'nod' }],
    // まだそろっていないとき（need = 「ムラサキウニが、あと2個」）
    remind: (need) => [
      { t: 'おお、来たね。研究の準備はばっちりだ。', mood: 'happy', g: 'wave' },
      { t: `${need}だね。たのんだよ。`, mood: 'smile', g: 'glasses' },
    ],
    // わたしたあと、建てかわる前（ここを離れると建てかわる）
    waiting: [
      { t: 'いまは研究の真っ最中でね。', mood: 'think', pose: 'chin' },
      { t: '結果が出たら、きっと知らせるよ。また、おいで。', mood: 'smile', g: 'nod' },
    ],
    // お小遣い（amount）をわたしたあと、ケチと言われたら
    kechi: [
      [{ t: 'ケチとは失敬な。研究者は、倹約が命なのだよ。', mood: 'trouble', g: 'glasses' }, { t: '……それに、子どもに大金をわたすと、ろくなことにならないからね。', mood: 'smile' }],
      [{ t: 'はっはっは！　お金の価値は、額ではないのだよ。', mood: 'laugh', g: 'laugh' }, { t: '……たぶんね。', mood: 'trouble' }],
      [{ t: '特許のお金は、ほとんど研究に使ってしまってね。', mood: 'think', pose: 'chin' }, { t: 'これでも、ふんぱつしたほうなんだよ。', mood: 'smile', g: 'nod' }],
    ],
    thx: [{ t: 'うむ。大事に使いたまえ。', mood: 'smile', g: 'nod' }],
    give: (yen) => ({ t: `これは、ほんのお礼だ。……${yen}円。`, mood: 'smile', g: 'point' }),
    // 全部おわったあとの最初の一言
    finished: [{ t: 'きみのおかげで、研究所はもう世界一だ。ときどき顔を見せておくれ。', mood: 'happy', g: 'wave' }],
  },

  // ---------- 夏海（湊さんの家: 0 空き地 → 7 タワーマンション。定食屋はそのまま）----------
  natsumi: {
    site: 'owner',
    list: [
      {
        want: { sazae: 5 }, reward: 800,
        ask: [
          { t: 'ねえ、ちょっと相談があるんだけど。', mood: 'normal', g: 'tilt' },
          { t: 'うちのメニュー、じつは毎日アジフライだけなの。そろそろ新しいのを出したくてさ。', mood: 'trouble', g: 'band' },
          { t: '考えてるのは……サザエのつぼ焼き定食！', mood: 'happy', g: 'fist' },
          { t: 'サザエを5個、とってきてくれない？　アヒル島の岩場にいっぱいいるんだって。', mood: 'smile', pose: 'hips' },
        ],
        where: [
          { t: 'サザエはね、浅い岩の上をのそのそ歩いてるよ。', mood: 'normal' },
          { t: '潜って近づいて、E で拾うの。かんたんでしょ？', mood: 'wink' },
        ],
        thanks: [
          { t: 'わあ、サザエ！　ぷりっぷりだね！', mood: 'happy', g: 'fist' },
          { t: 'よーし、さっそく試作だ。ありがとね！', mood: 'smile', g: 'wave' },
        ],
        built: [
          { t: 'ねえねえ、聞いて！　つぼ焼き定食が、すっごい評判でさ！', mood: 'happy', g: 'fist' },
          { t: 'もうかったから、となりの空き地を買って、家を建てたんだ！', mood: 'smile', pose: 'hips' },
          { t: '……まあ、小屋なんだけどね。', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { mejina: 3 }, reward: 500,
        ask: [
          { t: 'つぎのメニューはね、メジナの煮つけ！', mood: 'happy', g: 'fist' },
          { t: 'このへんじゃ「グレ」って呼ぶ人もいるの。甘辛く煮ると、ごはんが止まらないんだ。', mood: 'smile' },
          { t: 'メジナを3匹、おねがいできる？', mood: 'normal', g: 'tilt' },
        ],
        where: [
          { t: 'メジナは岩場の上のほうを、群れで泳いでるよ。', mood: 'normal' },
          { t: 'すばしっこいから、そーっと近づいてね。', mood: 'wink' },
        ],
        thanks: [
          { t: 'メジナ3匹、いい型だね！　ごはん3杯いけるよ。', mood: 'happy', g: 'fist' },
        ],
        built: [
          { t: '煮つけ定食、港のおじさんたちに大人気でさ！', mood: 'happy', g: 'fist' },
          { t: 'あの小屋、建てかえちゃった。瓦屋根の平屋！　縁側もあるんだよ。', mood: 'smile', pose: 'hips' },
        ],
      },
      {
        want: { aji: 5 }, reward: 1000,
        ask: [
          { t: 'あのね……じつは、アジフライのアジ、港で買ってたの。', mood: 'trouble', g: 'band' },
          { t: 'でも、自分たちでとった朝どれのアジで、なめろう定食を出したいんだ！', mood: 'happy', g: 'fist' },
          { t: 'アジを5匹、たのめる？', mood: 'smile', g: 'tilt' },
        ],
        where: [
          { t: 'アジは、島の沖の深いところを、群れで回ってるんだって。', mood: 'normal' },
          { t: '群れの通り道で待ちぶせするのがコツらしいよ。', mood: 'wink' },
        ],
        thanks: [
          { t: 'アジ5匹！　ぴかぴかだ……！', mood: 'surprise' },
          { t: 'たたいて、みそと薬味をまぜて……うーん、もう待てない！', mood: 'happy', g: 'fist' },
        ],
        built: [
          { t: 'なめろう定食、テレビの取材が来ちゃってさ！', mood: 'happy', g: 'fist' },
          { t: 'もうかったから、家を2階建てにしちゃった。バルコニーもあるんだよ！', mood: 'smile', pose: 'hips' },
        ],
      },
      {
        want: { kawahagi: 3 }, reward: 700,
        ask: [
          { t: 'カワハギって知ってる？　皮がぺろっとはがれる魚。', mood: 'normal', g: 'tilt' },
          { t: '肝がね、とろっとしてて最高なの。肝あえ定食を出したい！', mood: 'happy', g: 'fist' },
          { t: 'カワハギを3匹、おねがい。', mood: 'smile' },
        ],
        where: [
          { t: 'カワハギは岩場の底すれすれを泳いでるよ。', mood: 'normal' },
          { t: '海の底でじっとしてると、向こうから寄ってくるんだって。', mood: 'wink' },
        ],
        thanks: [
          { t: 'カワハギ3匹！　肝もぱんぱん！', mood: 'happy', g: 'fist' },
        ],
        built: [
          { t: '肝あえ定食、グルメ雑誌で星をもらっちゃった。', mood: 'happy', g: 'fist' },
          { t: 'それで家を、3階建てのアパートにしたの。部屋を貸して、家賃も入るんだ。', mood: 'wink', pose: 'hips' },
        ],
      },
      {
        want: { budai: 3 }, reward: 1200,
        ask: [
          { t: 'ブダイって、見た目はちょっと変わってるけど……', mood: 'think', g: 'tilt' },
          { t: '煮つけにすると、ほろっとやわらかくておいしいの。', mood: 'smile' },
          { t: 'ブダイを3匹、たのめる？', mood: 'normal', g: 'tilt' },
        ],
        where: [
          { t: 'ブダイは岩場の岩のまわり、底の近くにいるよ。', mood: 'normal' },
          { t: 'のんびりしてるから、ねらいやすいと思う。', mood: 'wink' },
        ],
        thanks: [
          { t: 'ブダイ3匹！　このおちょぼ口、かわいいよね。', mood: 'happy', g: 'laugh' },
        ],
        built: [
          { t: 'ブダイ定食、なんと海外のお客さんまで来るようになってさ。', mood: 'happy', g: 'fist' },
          { t: 'アパート、5階建てのマンションに建てかえちゃった！', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { akahata: 2 }, reward: 600,
        ask: [
          { t: 'アカハタの鍋、食べたことある？', mood: 'normal', g: 'tilt' },
          { t: 'まっ赤な魚でね、だしがすっごく出るの。夏でも食べたくなる鍋なんだ。', mood: 'happy' },
          { t: 'アカハタを2匹、おねがい！', mood: 'smile', g: 'fist' },
        ],
        where: [
          { t: 'アカハタは、岩の上にじっと乗ってるよ。', mood: 'normal' },
          { t: '赤いから、わりと見つけやすいかも。', mood: 'wink' },
        ],
        thanks: [
          { t: 'アカハタ2匹、まっ赤っか！　いいだしが出るよ〜。', mood: 'happy', g: 'fist' },
        ],
        built: [
          { t: 'アカハタ鍋が、全国ご当地グルメで優勝しちゃって！', mood: 'happy', g: 'fist' },
          { t: 'マンション、8階建てにしたよ。……ちょっと、やりすぎたかな？', mood: 'laugh', g: 'laugh' },
        ],
      },
      {
        want: { ishidai: 1, iseebi: 1, awabi: 2 }, reward: 1000,
        ask: [
          { t: 'ついに、みなとの看板メニューを作ろうと思うの。', mood: 'normal', pose: 'hips' },
          { t: 'その名も……「磯の大漁定食」！', mood: 'happy', g: 'fist' },
          { t: 'イシダイのお造りに、イセエビのみそ汁、アワビの踊り焼き！', mood: 'smile' },
          { t: 'イシダイ1匹、イセエビ1尾、アワビ2個……たのめる？', mood: 'normal', g: 'tilt' },
        ],
        where: [
          { t: 'イシダイは深い岩場。イセエビは岩の穴の奥。アワビは岩の横の面。', mood: 'normal' },
          { t: 'どれも大変だけど……キミなら、できるよ。', mood: 'wink' },
        ],
        thanks: [
          { t: 'ぜんぶそろってる……！', mood: 'surprise' },
          { t: 'ありがとう。これで、おばあちゃんに胸をはれるよ。', mood: 'smile', g: 'nod' },
        ],
        built: [
          { t: '大漁定食、予約が3年先までいっぱいになっちゃった。', mood: 'happy', g: 'fist' },
          { t: 'それで、ついに……12階建てのタワーマンション！', mood: 'laugh', g: 'laugh' },
          { t: 'てっぺんの部屋から、アヒル島が見えるんだよ。', mood: 'smile', pose: 'hips' },
        ],
      },
    ],
    ok: [{ t: 'やった！　たのんだよ。', mood: 'happy', g: 'fist' }],
    ready: [{ t: 'あれ？　そのバケツ……もしかして！', mood: 'surprise' }],
    later: [{ t: 'そっか。じゃあ、待ってるね。', mood: 'smile', g: 'wave' }],
    remind: (need) => [
      { t: 'お、来たね。', mood: 'happy', g: 'wave' },
      { t: `${need}だよ。おねがいね！`, mood: 'smile', pose: 'hips' },
    ],
    waiting: [
      { t: 'いま、新メニューの試作中！', mood: 'happy', g: 'fist' },
      { t: 'お客さんの反応が出たら教えるね。また来てよ。', mood: 'smile', g: 'wave' },
    ],
    kechi: [
      [{ t: 'あはは、ケチって言わないの！', mood: 'laugh', g: 'laugh' }, { t: '子どもに大金は、あげられませーん。', mood: 'wink' }],
      [{ t: '……家のローンがね、まだまだあるのよ。', mood: 'trouble', g: 'band' }, { t: 'つぎはもっと、はずむから！　たぶん！', mood: 'happy', g: 'fist' }],
      [{ t: 'えー、足りない？', mood: 'surprise' }, { t: 'じゃあ、こんどごはん大盛りにしたげる。', mood: 'wink' }],
    ],
    thx: [{ t: 'どういたしまして！　むだづかいしちゃダメだよ。', mood: 'smile', g: 'wave' }],
    give: (yen) => ({ t: `はい、これ、お礼。……${yen}円。`, mood: 'smile', pose: 'hips' }),
    finished: [{ t: 'キミのおかげで、みなとは町いちばんの店になったよ。またおいでね！', mood: 'happy', g: 'wave' }],
  },
};

// 「ムラサキウニが、あと2個」「イシダイが、あと1匹、アワビが、あと2個」
function needText(want, progress) {
  const parts = [];
  for (const [id, n] of Object.entries(want)) {
    const it = itemOf(id), left = n - progress.count(id);
    if (left > 0) parts.push(`${it.name}が、あと${left}${it.unit}`);
  }
  return parts.join('、');
}

// 頼まれごとの進みぐあいと、会話の組み立て
export class QuestBook {
  // progress: shared/progress.js。on: { reward(yen), give(want), change() } 画面の演出
  constructor(progress, on = {}) {
    this.progress = progress; this.on = on;
  }

  state(id) {
    const q = this.progress.data.quests;
    return (q[id] ||= { i: 0, st: 'none' });
  }
  quest(id) { return QUESTS[id]?.list[this.state(id).i] || null; }
  save() { this.progress.write(); this.on.change?.(); }

  // 起動時: わたしてあった所は、もう建てかわっている（モリ突きから帰ってきたとき・読み込み直したとき）
  settleOnLoad() {
    for (const id of Object.keys(QUESTS)) this.rebuilt(id, false);
  }
  // わたしてあって、まだ建てかわっていない所 [{ id, site }]
  pending() {
    return Object.keys(QUESTS).filter((id) => this.state(id).st === 'done').map((id) => ({ id, site: QUESTS[id].site }));
  }
  // 建てかわった（段階を 1 つ上げる）
  rebuilt(id, write = true) {
    const s = this.state(id);
    if (s.st !== 'done') return;
    const site = QUESTS[id].site, st = this.progress.data.stages;
    st[site] = (st[site] ?? 0) + 1;
    s.st = 'built';
    if (write) this.save();
  }

  // 画面の隅の「頼まれごと」: [{ id, want, ready, st }]
  active() {
    const out = [];
    for (const id of Object.keys(QUESTS)) {
      const s = this.state(id), q = this.quest(id);
      if (!q || (s.st !== 'asked' && s.st !== 'done' && s.st !== 'built')) continue;
      out.push({ id, want: q.want, st: s.st, ready: s.st === 'asked' && this.progress.has(q.want) });
    }
    return out;
  }

  // 話しかけたときの会話（なければ null → いつもの会話 lines.js）
  // S: lines.js の台本（名前・あいさつ・世間話）、visits: これまでに話した回数
  open(id, S, visits) {
    const Q = QUESTS[id];
    if (!Q) return null;
    const s = this.state(id), q = this.quest(id), P = this.progress;
    const chat = () => S.nodes[S.again[Math.floor(Math.random() * S.again.length)]];
    const act = (fn) => ({ act: fn });
    if (!q) {
      // ぜんぶおわった: ひとこと言ってから、いつもの世間話
      return visits === 0 ? null : [...Q.finished, ...chat()];
    }
    if (s.st === 'none') {
      // はじめて会ったときは、あいさつ（lines.js の hello のせりふ）から続けて頼む
      const hello = visits === 0 ? S.nodes[S.first].filter((l) => !l.ask) : [];
      const ok = [...Q.ok, ...(s.i === 0 ? [TRAVEL_HINT] : [])];
      return [
        ...hello, ...q.ask,
        act(() => { s.st = 'asked'; this.save(); }),
        { ask: [['まかせて！', ok], ['どこで獲れるの？', [...q.where, ...(s.i === 0 ? [TRAVEL_HINT] : []), ...Q.ok]]] },
      ];
    }
    if (s.st === 'asked') {
      if (P.has(q.want)) {
        const deliver = [
          act(() => { if (P.take(q.want)) { s.st = 'done'; this.save(); this.on.give?.(q.want); } }),
          ...q.thanks,
        ];
        return [...Q.ready, { ask: [['わたす', deliver], ['まだ持っておく', Q.later]] }];
      }
      return [...Q.remind(needText(q.want, P)), { ask: [['どこで獲れるんだっけ？', q.where], ['ほかの話', chat()], ['またね', 'bye']] }];
    }
    if (s.st === 'done') return Q.waiting;
    // built: もうかって建てた話 → お小遣い → 次の頼みごとへ（次に話しかけたとき）
    const yen = q.reward;
    const kechi = Q.kechi[s.i % Q.kechi.length];
    return [
      ...q.built,
      Q.give(yen.toLocaleString('ja-JP')),
      act(() => { P.data.money += yen; s.i++; s.st = 'none'; this.save(); this.on.reward?.(yen); }),
      { ask: [[`……え、${yen.toLocaleString('ja-JP')}円？`, kechi], ['ありがとう！', Q.thx]] },
    ];
  }
}
