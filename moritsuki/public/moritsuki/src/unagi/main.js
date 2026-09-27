// ウナギ掬いの入口（/unagi/）
import { Game } from './game.js';

const canvas = document.getElementById('c');
const game = new Game(canvas);
game.init().catch((e) => {
  console.error(e);
  const msg = document.querySelector('#loading .load-msg');
  if (msg) msg.textContent = `読み込みに失敗しました: ${e.message || e}`;
});
