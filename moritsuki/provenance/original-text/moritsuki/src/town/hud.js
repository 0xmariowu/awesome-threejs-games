// 画面の表示: 入った場所の地名
import { PLACES } from './layout.js';

// ファストトラベルで行けるのは 定食屋・研究所 だけ（spot/look は landmarks.js が PLACES に書く、降りる場所と向き）。
// 自分の家は歩きはじめる所なので行き先にはしない（spot は進入禁止の輪に使う）。
// ほかの地名は travel: false（空から見たときの名前だけ）。
// game があるのは遊び場（ピンを押すと、その遊びへ行くかを聞く。中身は GAMES）。unlock は遊べるようになる印（shared/progress.js の unlocked）。
// unlock のない遊び場は、はじめから遊べる
export const NAMED = () => [
  { name: '自分の家', x: PLACES.home.x, z: PLACES.home.z, r: 15, spot: PLACES.home.spot, look: PLACES.home.look, travel: false },
  { name: '吉山新町公園', x: PLACES.park.x, z: PLACES.park.z, r: 20, travel: false },
  { name: '定食 みなと', x: PLACES.teishoku.x, z: PLACES.teishoku.z, r: 17, spot: PLACES.teishoku.spot, look: PLACES.teishoku.look },
  { name: '水産研究所', x: PLACES.lab.x, z: PLACES.lab.z, r: 70, spot: PLACES.lab.spot, look: PLACES.lab.look },
  { name: '西田川 河口', x: 22, z: 27, r: 16, travel: false },
  { name: 'アヒル島行 渡船のりば', x: PLACES.ferry.x, z: PLACES.ferry.z, r: 16, travel: false },
  { name: '吉山漁港', x: 85, z: 85, r: 48, travel: false },
  // 古宿の砂浜 = 蛤突きの「南の浜」。ピンは砂の上（at）に立てる
  { name: '南の浜', x: 400, z: 345, r: 85, game: 'hamaguri', at: [395, 312] },
  // 夜の遊び場: 西の岬の湾の側（内の浜）でガザミ拾い、外海の側（外の浜）でクサフグ拾い、町の西の田んぼの側溝で鰻掬い
  { name: '内の浜', x: -261, z: 188, r: 40, game: 'gazami', at: [-261, 188] },
  { name: '外の浜', x: -446, z: -88, r: 40, game: 'kusafugu', at: [-446, -88] },
  { name: '田んぼの側溝', x: 320, z: 20, r: 40, game: 'unagi', at: [320, 20] },
  { name: '東の岬', x: 254, z: 400, r: 75, travel: false },
  { name: '西の岬', x: -383, z: 283, r: 100, travel: false },
  { name: '吉山湾', x: 30, z: 210, r: 130, sea: true, travel: false },
  { name: 'アヒル島', x: PLACES.island.x, z: PLACES.island.z, r: 60, game: 'mori', unlock: 'mori' },
];

// 遊び場の中身: ピンの絵（紺の線。押している間は橙に塗りかえる）・行くかどうかのカードの文言・行き先。
// peak: 地名のまわりでいちばん高い所にピンを立てる（島の頂）
// url は町のページ（トップ）からの相対。index.html まで書く（フォルダの URL を index.html にしてくれない所でも開けるように）
// title は町の空の上だけの呼び名。生き物は漢字にせずカタカナで書く（ゲームの中の名前は「蛤突き」「鰻掬い」のまま）
const ICON = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
export const GAMES = {
  mori: {
    title: 'モリ突き', go: '島へ渡る', url: 'mori/index.html?town', peak: true,
    lead: '渡し船でアヒル島へ。素潜りで魚を突こう。<br />獲った物は持ち物に入る。',
    icon: ICON('<path d="M4.5 19.5 18 6M18 6l-1.2 4.6M18 6l-4.6 1.2" fill="none" stroke="#0b3a5a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15.5c1.4 1 2.6 1 4 0s2.6-1 4 0" fill="none" stroke="#0b3a5a" stroke-width="1.8" stroke-linecap="round"/>'),
  },
  hamaguri: {
    title: 'ハマグリ突き', go: '浜へ行く', url: 'hamaguri/index.html?town',
    lead: '干潮の南の浜へ。棒で砂を突き、<br />カチンと鳴ったら手で掘り出そう。<br />獲った貝は持ち物に入る。',
    icon: ICON('<path d="M4 14.5C6 7.5 18 7.5 20 14.5c-2.5 3-13.5 3-16 0Z" fill="none" stroke="#0b3a5a" stroke-width="2" stroke-linejoin="round"/><path d="M12 8.2 9.6 16.8M12 8.2l2.4 8.6M12 8.2v9.2" fill="none" stroke="#0b3a5a" stroke-width="1.5" stroke-linecap="round"/><path d="M19 2.5 14.6 7.4" fill="none" stroke="#0b3a5a" stroke-width="2" stroke-linecap="round"/>'),
  },
  gazami: {
    title: 'ガザミ拾い', go: '浜へ行く', url: 'gazami/index.html?town',
    lead: '夜の内の浜へ。浅瀬の砂を手でなでて、<br />「いてっ」ときたらつかみ上げよう。<br />獲ったカニは持ち物に入る。',
    icon: ICON('<path d="M6.5 14.5c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6-2.5 3.8-5.5 3.8-5.5-.8-5.5-3.8Z" fill="none" stroke="#0b3a5a" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 11.5 4.8 8.2M16.5 11.5l2.7-3.3M6.6 15.8 3 17.6M17.4 15.8l3.6 1.8M8 18l-2 2.6M16 18l2 2.6" fill="none" stroke="#0b3a5a" stroke-width="1.6" stroke-linecap="round"/><path d="M3.2 8.6c-.6-2 .6-4 2.4-4.3l-.5 2.3 2.2-.4c.2 1.6-1.2 2.9-4.1 2.4ZM20.8 8.6c.6-2-.6-4-2.4-4.3l.5 2.3-2.2-.4c-.2 1.6 1.2 2.9 4.1 2.4Z" fill="#0b3a5a"/>'),
  },
  kusafugu: {
    title: 'クサフグ拾い', go: '浜へ行く', url: 'kusafugu/index.html?town',
    lead: '夜の外の浜へ。波打ち際で光るのは<br />フグの眼か、石の反射か。見分けて手づかみ。<br />獲ったフグは持ち物に入る。',
    icon: ICON('<path d="M17 12c0 3.6-3 6-6.8 6S3 15.6 3 12s3.2-6 7.2-6S17 8.4 17 12Z" fill="none" stroke="#0b3a5a" stroke-width="2"/><path d="m17 12 4-3.4v6.8Z" fill="none" stroke="#0b3a5a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="10.4" r="1.4" fill="#0b3a5a"/><path d="M9.5 13.8h.01M12.5 12.2h.01M13 15.2h.01M10.6 9h.01" stroke="#0b3a5a" stroke-width="2.2" stroke-linecap="round"/>'),
  },
  unagi: {
    title: 'ウナギ掬い', go: '側溝へ行く', url: 'unagi/index.html?town',
    lead: '夜ふけの田んぼの側溝へ。ライトで照らして、<br />タモ網でウナギをすくおう。小さいのは逃がす。<br />獲った物は持ち物に入る。',
    icon: ICON('<path d="M3 16c2.2-3.2 4.4-3.2 6.2 0s4 3.2 6 0 3.2-3.6 5.8-2.4" fill="none" stroke="#0b3a5a" stroke-width="2.4" stroke-linecap="round"/><circle cx="20.2" cy="13" r=".9" fill="#0b3a5a"/><ellipse cx="9" cy="6.2" rx="4.6" ry="2.6" fill="none" stroke="#0b3a5a" stroke-width="1.7"/><path d="M13.6 6.2 20 2.5" fill="none" stroke="#0b3a5a" stroke-width="1.8" stroke-linecap="round"/>'),
  },
};

export class Hud {
  constructor() {
    this.toast = document.getElementById('toast');
    this.cur = null;
    this.named = NAMED();
  }

  // 地名: 入った場所の名前を出す
  update(player) {
    let best = null;
    for (const n of this.named) {
      const d = Math.hypot(player.x - n.x, player.z - n.z);
      if (d < n.r && (!best || n.r < best.r)) best = n;
    }
    if (best === this.cur) return;
    this.cur = best;
    if (!best) return;
    this.toast.textContent = best.name;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
  }
}
