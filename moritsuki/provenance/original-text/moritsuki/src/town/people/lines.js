// 会話（テスト用）。話すのはいつも相手（主人公は選ぶだけ）
// 1 行: { t: せりふ, mood?: normal|happy|laugh|wink|think|surprise|trouble|smile, g?: 身ぶり, pose?: 姿勢 }
// 選択肢: { ask: [[ことば, 次の話], ...] }。話の最後まで行ったら会話はおわり（next があればつづける）
export const SCRIPTS = {
  natsumi: {
    name: '夏海',
    first: 'hello',
    again: ['again1', 'again2', 'again3'],
    nodes: {
      hello: [
        { t: 'お、見ない顔だね。', mood: 'surprise' },
        { t: 'もしかして……夏休みでこっちに来てるって子？', mood: 'normal', g: 'tilt' },
        { t: 'あたしは湊 夏海。この「定食 みなと」をやってるんだ。', mood: 'smile', pose: 'hips' },
        { t: 'おばあちゃんから継いで、まだ二年目だけどね。', mood: 'laugh', g: 'laugh' },
        { ask: [['おすすめは？', 'menu'], ['お店、ひとりでやってるの？', 'alone'], ['またね', 'bye']] },
      ],
      menu: [
        { t: '今日はね……アジフライ定食！', mood: 'happy', g: 'fist' },
        { t: '朝どれのアジを、揚げたてで出すの。しっぽまでサクサクだよ。', mood: 'normal' },
        { t: '……なんてね。じつは毎日アジフライなんだけど。', mood: 'wink' },
        { ask: [['食べてみたい！', 'eat'], ['またね', 'bye']] },
      ],
      eat: [
        { t: 'ふふ、いい返事。', mood: 'happy' },
        { t: 'でもごめん、今はお昼の仕込み中なんだ。', mood: 'trouble', g: 'band' },
        { t: 'また今度おいで。大盛りにしとくから！', mood: 'happy', g: 'fist' },
      ],
      alone: [
        { t: 'そうだよ。朝は港で魚を見て、昼はお店、夜は仕込み。', mood: 'normal' },
        { t: '大変じゃないかって？　んー……', mood: 'think', g: 'tilt' },
        { t: '好きでやってるからね。ぜんぜん平気！', mood: 'happy', g: 'fist' },
        { t: 'それに、港のおじさんたちがよくいい魚をまわしてくれるんだ。', mood: 'smile' },
        { ask: [['おすすめは？', 'menu'], ['またね', 'bye']] },
      ],
      bye: [
        { t: 'うん、またね。', mood: 'smile', g: 'wave' },
        { t: '暑いから、水分とるんだよ。田んぼに落ちないようにね！', mood: 'wink' },
      ],
      again1: [
        { t: 'お、また来たね。', mood: 'happy', g: 'wave' },
        { t: 'どう？　この町にはもう慣れた？', mood: 'normal', g: 'tilt' },
        { ask: [['おすすめは？', 'menu'], ['またね', 'bye']] },
      ],
      again2: [
        { t: 'いらっしゃい……って、なんだキミか。', mood: 'surprise' },
        { t: 'あはは、うそうそ。待ってたよ。', mood: 'laugh', g: 'laugh' },
        { ask: [['お店、ひとりでやってるの？', 'alone'], ['またね', 'bye']] },
      ],
      again3: [
        { t: 'ねえ、研究所の磯貝さんには会った？', mood: 'normal' },
        { t: 'あの人、ああ見えてうちの常連なんだ。いつもサバの味噌煮。', mood: 'smile', pose: 'hips' },
        { t: '研究の話になると長いから、気をつけてね。', mood: 'wink' },
      ],
    },
  },
  isogai: {
    name: '磯貝博士',
    first: 'hello',
    again: ['again1', 'again2', 'again3'],
    nodes: {
      hello: [
        { t: 'ん？　おお、きみが港のほうに来たという子だね。', mood: 'surprise', pose: 'stand' },
        { t: 'わたしは磯貝。この吉山水産研究所の所長をしている。', mood: 'smile', g: 'glasses' },
        { t: '……といっても、いまは研究員がわたし一人なんだがね。', mood: 'trouble' },
        { t: 'はっはっは！', mood: 'laugh', g: 'laugh' },
        { ask: [['なにを研究してるの？', 'study'], ['一人って、どうして？', 'alone'], ['またね', 'bye']] },
      ],
      study: [
        { t: 'よくぞ聞いてくれた。', mood: 'happy', pose: 'lecture' },
        { t: '吉山湾の生き物すべてだよ。魚、貝、エビやカニ、海藻……', mood: 'normal', pose: 'lecture' },
        { t: 'とくにアヒル島のまわりには、めずらしい魚がいるらしくてね。', mood: 'think', pose: 'chin' },
        { t: 'きみも何か見つけたら、ぜひ教えてくれたまえ。', mood: 'smile', g: 'point' },
        { ask: [['一人って、どうして？', 'alone'], ['またね', 'bye']] },
      ],
      alone: [
        { t: 'ふむ……予算というやつだよ。', mood: 'think', pose: 'chin' },
        { t: 'でも、調べたことが役に立つと分かれば、', mood: 'normal' },
        { t: 'この研究所も、また大きくできるかもしれない。', mood: 'smile', g: 'nod' },
        { t: 'そのときは、きみの力も借りたいものだね。', mood: 'happy', g: 'point' },
        { ask: [['なにを研究してるの？', 'study'], ['またね', 'bye']] },
      ],
      bye: [
        { t: 'うむ。熱中症に気をつけるんだよ。', mood: 'smile', g: 'nod' },
        { t: '帽子はちゃんとかぶって、水はこまめに、だ。', mood: 'normal', g: 'point' },
      ],
      again1: [
        { t: 'おお、来たね。', mood: 'happy', g: 'wave' },
        { t: '今日は潮がよく引いている。浜の観察にはいい日だ。', mood: 'normal', g: 'glasses' },
        { ask: [['なにを研究してるの？', 'study'], ['またね', 'bye']] },
      ],
      again2: [
        { t: 'ふむ……ふむふむ……', mood: 'think', pose: 'chin' },
        { t: 'おっと、すまない。考えごとをしていた。', mood: 'surprise' },
        { t: 'ヒラメの目は、どうして左に寄るのか……じつに興味深い。', mood: 'smile', g: 'point' },
      ],
      again3: [
        { t: '定食屋の夏海くんには会ったかね？', mood: 'normal' },
        { t: 'あそこのサバの味噌煮は、学術的に見ても完璧だよ。', mood: 'happy', g: 'point' },
        { t: '……研究の話は長いって？　はて、だれが言ったのかな。', mood: 'trouble', g: 'glasses' },
      ],
    },
  },
};
