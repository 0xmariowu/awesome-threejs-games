// 吉山の町から遊ぶときのミニゲーム（/<遊び>/?town）。遊びそのものは同じで、タイトルと結果画面に「町に帰る」を足すだけ。
// 町のプログラムは import しない（帰り道の URL と、町と共通のセーブ shared/progress.js だけ使う）。従来の URL（?town なし）のときは何もしない
import { progress } from './progress.js';

const Q = new URLSearchParams(location.search);
export const TOWN = Q.has('town');

// from: 遊びの名前（hamaguri など）、title: 町から来たときのタブの名前
export function townLink({ from, title }) {
  return {
    TOWN,
    // 町へ戻る URL（トップの町の空の上へ。自分は定食屋の前。確認用の ?mute・?debug は引き継ぐ）。
    // index.html まで書く（フォルダの URL を index.html にしてくれない所でも開けるように）
    townURL() {
      const q = ['arrive=teishoku', `from=${from}`, ...['mute', 'debug'].filter((k) => Q.has(k))];
      return `../index.html?${q.join('&')}`;
    },
    // 画面の文言を町モードのものにする（起動時に 1 回）
    applyTownTexts() {
      if (!TOWN) return;
      const $ = (s) => document.querySelector(s);
      document.title = title;
      const home = document.createElement('button');
      home.dataset.act = 'toTown';
      home.innerHTML = '<span class="k">六</span>町に帰る';
      $('#title .menu').appendChild(home);
      const back = $('#results [data-act="toTitle"]');
      back.dataset.act = 'toTown';
      back.textContent = 'やめて町に帰る';
    },
    // 獲った物を町の持ち物に入れる（入れた数を返す）。list = [{ id }]（ハズレ・逃がした物は入れない）
    stashCatch(list) {
      if (!TOWN || !list.length) return 0;
      progress.load();
      for (const it of list) progress.add(it.id, 1);
      progress.write();
      return list.length;
    },
  };
}
