/*
 * スマートゲーム 共通フッターバナー広告 — 差し替え（ローテーション）制御
 *
 * ad/banner.html は広告タグを直接持たず、広告タグ本体（ad/slot.html）を
 * iframe として抱えるだけの「枠」になっている。このスクリプトは
 * 一定時間ごとに slot.html を新しく読み込み、広告を差し替える。
 *
 * 差し替えは二重バッファ方式：
 *   1. 次の広告を裏（透明）で読み込む
 *   2. 新しい広告が実際に描画された（＝高さが通知された）ら表示を入れ替える
 *   3. 新しい広告が来なければ表示中の広告をそのまま残す
 * これにより、読み込み中に枠が空白になる瞬間が発生しない。
 *
 * 広告の高さはゲームページ（各ゲームの js/ad-banner.js）へ中継する。
 * ゲーム側から見た通信内容（smartgame-ad-height）は従来どおりなので、
 * ゲーム側の変更は不要。
 *
 * slot.html は sandbox（allow-same-origin 無し）の iframe に読み込む。
 * 広告タグは別オリジン（opaque origin。ev.origin は "null"）として動き、
 * このページやゲームページの localStorage・Cookie・DOM に触れない。
 * そのため slot.html からの通知は origin ではなく「自分が作った枠の contentWindow か」で見分ける。
 */
(function () {
  'use strict';

  var SLOT_URL = 'slot.html';
  var ROTATE_MS = 20000;     // 広告を差し替える間隔（画面が見えている時間で計測）
  /* 次の広告を待つ時間。slot.html は最大4社（i-mobile → MicroAd →
     Ad Generation → 自社広告）を順に試すため、その全体の所要時間より長くとる */
  var LOAD_TIMEOUT_MS = 12000;
  var FADE_MS = 200;         // 入れ替え時のクロスフェード時間
  var TICK_MS = 1000;
  var MAX_HEIGHT = 320;      // 想定外に巨大な広告でゲームが潰れるのを防ぐ上限

  /* 広告タグを別オリジンに閉じ込める sandbox。クリック（別タブ・最上位の遷移）と、事業者によっては使うフォームだけ許す。
     allow-same-origin は付けない（付けるとゲームページと同一オリジンになり、localStorage 等に触れてしまう） */
  var SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';

  var stage = document.getElementById('ad-stage');
  if (!stage) return;

  var current = null;        // 表示中の枠（iframe）
  var pending = null;        // 裏で読み込み中の次の枠
  var pendingTimer = 0;
  var visibleMs = 0;         // 表示中の広告が「見えている状態で」経過した時間
  var lastSent = -1;

  function createSlot() {
    var f = document.createElement('iframe');
    f.className = 'ad-slot-frame';
    f.title = '広告';
    f.setAttribute('scrolling', 'no');
    f.setAttribute('frameborder', '0');
    f.setAttribute('sandbox', SANDBOX);   // src より前に付ける（あとから付けても読み込み済みの文書には効かない）
    f.src = SLOT_URL;
    stage.appendChild(f);
    return f;
  }

  function setHeight(h) {
    stage.style.height = h + 'px';
    if (h === lastSent) return;
    lastSent = h;
    try {
      // 親はゲームページ（同一オリジン）。送信先も自オリジンに限定する
      parent.postMessage({ type: 'smartgame-ad-height', height: h }, window.location.origin);
    } catch (e) {
      /* 通知できなくても広告表示自体は継続する */
    }
  }

  function dropPending() {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; }
    if (pending && pending.parentNode) pending.parentNode.removeChild(pending);
    pending = null;
  }

  /* 裏で読み込んだ枠に広告が出たので、表示中の枠と入れ替える */
  function promote(h) {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; }

    var old = current;
    current = pending;
    pending = null;
    current.removeAttribute('aria-hidden');
    current.classList.add('is-current');   // 上に重なった状態でフェードイン
    setHeight(h);
    visibleMs = 0;

    // フェードが終わってから前の広告を取り除く（一瞬でも空白を見せない）
    setTimeout(function () {
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }, FADE_MS + 50);
  }

  function rotate() {
    if (pending) return;
    pending = createSlot();
    pending.setAttribute('aria-hidden', 'true');
    pendingTimer = setTimeout(function () {
      pendingTimer = 0;
      dropPending();
      visibleMs = 0;   // 次の周期であらためて挑戦する
    }, LOAD_TIMEOUT_MS);
  }

  window.addEventListener('message', function (ev) {
    // 広告枠（slot.html）は sandbox なので origin は "null"。自分が作った枠の window からの通知だけを受け取る
    // （クリエイティブ側の別オリジンの iframe からのものは source が一致しないので捨てる）
    if (!ev.source || !((current && ev.source === current.contentWindow) || (pending && ev.source === pending.contentWindow))) return;
    var data = ev.data;
    if (!data || data.type !== 'smartgame-ad-slot-height') return;
    var h = Math.round(Number(data.height));
    if (!isFinite(h) || h <= 0 || h > MAX_HEIGHT) return;

    if (current && ev.source === current.contentWindow) setHeight(h);
    else if (pending && ev.source === pending.contentWindow) promote(h);
  });

  /*
   * 差し替えの間隔は「画面が見えている時間」で数える。
   * タブが裏に回っている間や、ゲームが閉じられている間に
   * 広告だけ読み込み続けることがないようにするため。
   */
  setInterval(function () {
    if (document.hidden) return;
    if (lastSent <= 0) return;   // 最初の広告がまだ出ていない
    if (pending) return;         // 読み込み中
    visibleMs += TICK_MS;
    if (visibleMs >= ROTATE_MS) {
      visibleMs = 0;
      rotate();
    }
  }, TICK_MS);

  // 最初の1枠は banner.html に直接書かれている（読み込みを早く始めるため）
  current = stage.querySelector('iframe');
  if (!current) {
    current = createSlot();
    current.classList.add('is-current');
  }
})();
