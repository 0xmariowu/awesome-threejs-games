// 吉山の町から遊ぶときの銛一本（/mori/?town）。漁そのものは同じで、舞台の文言・ランク・結果画面のボタンだけ差しかえる。
// 獲物は町の持ち物に入り、「町に帰る」で町の空の上に戻る。町から来ずに開いた（/mori/）ときは何もしない
import { progress } from './shared/progress.js';

const Q = new URLSearchParams(location.search);
export const TOWN = Q.has('town');

// 町へ戻る URL（確認用の ?mute・?debug は引き継ぐ）
export function townURL() {
  const q = ['arrive=teishoku', ...['mute', 'debug'].filter((k) => Q.has(k))];
  return `../index.html?${q.join('&')}`; // 町はトップ。index.html まで書く（フォルダの URL を開けない所のため）
}

// 町モードのランク（しきい値と色は元のランクと同じ。ボウズは何も獲れなかったときだけ）
export const TOWN_RANKS = [
  { min: 0, title: 'ボウズ', sub: '今日は、なにも獲れなかった……', color: '#8a9aa6' },
  { min: 1, title: 'ひよっこ', sub: 'まずは一匹。ここからだ。', color: '#8a9aa6' },
  { min: 1500, title: '磯あそび', sub: 'なかなかの腕前。', color: '#6fc2b8' },
  { min: 5000, title: '小さな漁師', sub: '夏海さんがおどろくぞ。', color: '#62b0ff' },
  { min: 12000, title: '突きの名人', sub: '港のおじさんも顔負け。', color: '#ffbf3a' },
  { min: 30000, title: '島のヌシ', sub: '夏休みの伝説になった。', color: '#ff5a3a' },
];

// 画面の文言を町モードのものにする（起動時に 1 回）
export function applyTownTexts() {
  if (!TOWN) return;
  const $ = (s) => document.querySelector(s);
  document.title = '銛一本 — アヒル島の素潜り（吉山）';
  $('#loading .load-msg').textContent = 'アヒル島へ渡っています';
  $('#title .title-sub').textContent = 'アヒル島 素潜り漁';
  $('#title .hanko').textContent = '夏';
  $('#title .title-copy').innerHTML = '夏休み、アヒル島の海へ。<br />頼まれた魚は、自分で突け。';
  const menu = $('#title .menu');
  const home = document.createElement('button');
  home.dataset.act = 'toTown';
  home.innerHTML = '<span class="k">五</span>町に帰る';
  menu.appendChild(home);
  $('#results .res-head h2').textContent = '本日の漁果';
  $('#results [data-act="again"]').textContent = 'もう一回、漁に出る';
  const back = $('#results [data-act="toTitle"]');
  back.dataset.act = 'toTown';
  back.textContent = 'やめて町に帰る';
}

// 漁のはじまりのナレーション。町には日数がないので「N日目」は出さない（day は初めてかどうかと、言葉の入れかえだけに使う）
export function townIntro(day, taiko) {
  const head = { text: 'アヒル島', cls: 'day', wait: day === 1 ? 1300 : 1200 };
  const big = { text: '銛一本。', cls: 'big', wait: day === 1 ? 1600 : 1400, sound: taiko };
  if (day === 1) return [head, { text: '夏休み。', wait: 1200 }, { text: '頼まれた魚は——', wait: 1100 }, big];
  const mid = ['今日も、海は青い。', '息を止めて、深く。', '岩のすき間に、なにかいる。', 'ヌシは、まだ洞窟にいる。'][day % 4];
  return [head, { text: mid, wait: 1400 }, big];
}

// 本日の漁果を町の持ち物に入れる（入れた数を返す）
export function stashCatch(list) {
  if (!TOWN || !list.length) return 0;
  for (const it of list) progress.add(it.id, 1);
  progress.write();
  return list.length;
}
