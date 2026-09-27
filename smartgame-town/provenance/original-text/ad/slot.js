/*
 * スマートゲーム 共通フッターバナー広告 — 広告枠1つぶんの内側スクリプト
 *
 * 広告クリエイティブが実際に描画された高さを、親（ad/banner.html）へ通知する。
 * banner.html はこの通知をもって「この枠に広告が出た」と判断し、
 *   - 表示中の枠なら … 高さをゲームページへ中継する
 *   - 差し替え用に裏で読み込んだ枠なら … 表示中の枠と入れ替える
 * という制御を行う。広告が出るまでは何も通知しないので、
 * 空の枠に差し替わってしまうことはない。
 *
 * ■ ウォーターフォール（優先順位つきの配信）
 *   1. i-mobile        （slot.html に直接書いてある＝最速で読み込みが始まる）
 *   2. MicroAd         （このスクリプトが差し込む）
 *   3. Ad Generation   （同上）
 *   4. 自社アプリのバナー（img/house-*.webp からランダムに1つ）
 * 上位が制限時間内に描画されなかったときだけ、その枠を DOM ごと捨てて次へ進む。
 * 途中で埋まれば、それ以降の広告タグは一切読み込まない。
 *
 * ■ 時間の制約
 * ゲーム側（各ゲームの js/ad-banner.js）は広告が 8 秒出なければ枠を畳む。
 * そのため何社試したかに関わらず HOUSE_DEADLINE_MS までに自社広告へ切り替える。
 * 自社広告の画像は最初から先読みしておき、切り替えを即座に行う。
 *
 * 差し替え（20秒ごと）のたびに slot.html ごと読み込み直されるので、
 * 次の周期ではまた i-mobile の配信から試し直す。
 *
 * ■ sandbox
 * このページは banner.html から sandbox（allow-same-origin 無し）の iframe として読み込まれる。
 * 広告タグは別オリジンとして動き、ゲームページの localStorage・Cookie・DOM には触れない。
 * document.cookie / localStorage はこのページの中では例外になる（広告タグが使えなければ次の事業者へ進む）。
 */
(function () {
  'use strict';

  var MAX_HEIGHT = 320;          // 想定外に巨大な広告でゲームが潰れるのを防ぐ上限
  var POLL_MS = 200;             // 「広告が出たか」を見に行く間隔
  var HOUSE_DEADLINE_MS = 6500;  // これを過ぎたら残りの事業者を飛ばして自社広告を出す
  var MIN_AD_W = 20;             // これ未満の要素は計測用ピクセル等とみなす
  var MIN_AD_H = 20;

  /*
   * 配信を試す順番。上から順に1社ずつ試す。
   * mount が null のものは slot.html に直接書かれている（＝差し込み不要）。
   * wait は「この社に与える猶予（ms）」。
   */
  var NETWORKS = [
    { key: 'imobile', wait: 2500, mount: null },
    { key: 'microad', wait: 2000, mount: mountMicroad },
    { key: 'adg',     wait: 2000, mount: mountAdGeneration }
  ];

  /*
   * 自社広告（どこからも配信されなかったときの最後の受け皿）。
   * 画像はすべて 1280×200（320×50 バナーと同じ 6.4:1）に揃えてあるので、
   * どれが当たっても枠の高さは変わらない。
   */
  var HOUSE_ADS = [
    {
      img: 'img/house-flips.webp?ver=20260803-1',
      alt: 'FLIPS 新感覚ロジックパズル - App Store でダウンロード',
      url: 'https://apps.apple.com/jp/app/flips-%E6%95%B0%E5%AD%97%E3%83%AD%E3%82%B8%E3%83%83%E3%82%AF%E3%83%91%E3%82%BA%E3%83%AB/id6787373890'
    },
    {
      img: 'img/house-echo-grid.webp?ver=20260803-1',
      alt: 'ECHO GRID 響きあう数字パズル - App Store でダウンロード',
      url: 'https://apps.apple.com/jp/app/echo-grid-%E9%9F%BF%E3%81%8D%E3%81%82%E3%81%86%E6%95%B0%E5%AD%97%E3%83%91%E3%82%BA%E3%83%AB/id6791798318'
    },
    {
      img: 'img/house-bodotool.webp?ver=20260803-1',
      alt: 'ボドツール ボードゲーム補助アプリ - App Store でダウンロード',
      url: 'https://apps.apple.com/jp/app/%E3%83%9C%E3%83%89%E3%83%84%E3%83%BC%E3%83%AB-%E3%83%9C%E3%83%BC%E3%83%89%E3%82%B2%E3%83%BC%E3%83%A0%E8%A3%9C%E5%8A%A9%E3%82%A2%E3%83%97%E3%83%AA/id6788137483'
    }
  ];

  var startedAt = Date.now();
  var slot = document.getElementById('ad-slot');
  if (!slot) return;

  var index = -1;      // 今試している事業者（NETWORKS の添字）
  var wrap = null;     // 今試している事業者の入れ物
  var stepTimer = 0;
  var deadline = 0;    // 今の事業者を見限る時刻
  var settled = false; // 広告が出た（＝親への通知を始めてよい）
  var lastSent = -1;

  /* ------------------------------------------------------------------
     広告タグの差し込み（1社 = 1関数）
     ------------------------------------------------------------------ */

  /* MicroAd Compass */
  function mountMicroad(host) {
    var SPOT = '556ca4dcbaea4ded9abdfe00689879b8';

    var box = document.createElement('div');
    box.id = SPOT;
    box.setAttribute('data-ad-box', '');
    box.style.width = '320px';
    box.style.height = '50px';
    host.appendChild(box);

    // 共通コード（本来は head に置くもの。1枠1ページなのでここで初期化する）
    var compass = window.microadCompass = window.microadCompass || {};
    compass.queue = compass.queue || [];
    compass.queue.push({ spot: SPOT });

    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.charset = 'UTF-8';
    s.async = true;
    s.src = 'https://j.microad.net/js/compass.js';
    s.onload = function () {
      // 読み込みを待つ間に次の事業者へ移っていたら初期化しない
      if (!document.body.contains(box)) return;
      try { new compass.AdInitializer().initialize(); } catch (e) { /* 次へ進む */ }
    };
    host.appendChild(s);
  }

  /* Ad Generation */
  function mountAdGeneration(host) {
    var TARGET = 'adg_223846';

    var box = document.createElement('div');
    box.id = TARGET;
    box.setAttribute('data-ad-box', '');
    host.appendChild(box);

    var s = document.createElement('script');
    s.src = 'https://i.socdm.com/sdk/js/adg-script-loader.js?id=223846&targetID=' +
            TARGET + '&displayid=1&adType=SP&async=true&tagver=2.0.0';
    host.appendChild(s);
  }

  /* ------------------------------------------------------------------
     配信されたかどうかの判定
     ------------------------------------------------------------------ */

  /*
   * 入れ物の中に「実際に描画された広告」があるか。
   *
   * 高さでは判定できない。配信の有無に関わらず作られるものがあるため：
   *   - MicroAd … 320×50 の空の div（広告タグの置き場所）
   *   - Ad Generation … 320×50 の空の iframe（中身は about:blank のまま）
   * 前者は data-ad-box を付けて判定から除外し、後者は iframe の中身まで見る。
   */
  function rendered(host, depth) {
    if (!host) return false;
    var nodes = host.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'NOSCRIPT') continue;
      if (n.hasAttribute('data-ad-box')) continue;
      // 1×1 の同期用ピクセルや、潰れている入れ物は広告とみなさない
      var w = n.offsetWidth, h = n.offsetHeight;
      if (typeof w !== 'number' || typeof h !== 'number') {   // SVG 等は offsetWidth を持たない
        var rect = n.getBoundingClientRect();
        w = rect.width; h = rect.height;
      }
      if (!(w >= MIN_AD_W && h >= MIN_AD_H)) continue;
      if (tag === 'IFRAME' && !iframeFilled(n, depth || 0)) continue;
      return true;
    }
    return false;
  }

  /*
   * 広告枠として置かれた iframe に、実際にクリエイティブが入っているか。
   * Ad Generation は配信が無くても 320×50 の iframe を作り、その中に
   * Cookie 同期用の 1×1 iframe だけを書き込むため、中身まで見る必要がある。
   */
  function iframeFilled(frame, depth) {
    if (depth >= 3) return true;   // 深追いしない（実用上ここまで来れば広告が入っている）
    var doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return true;   // 別オリジン＝クリエイティブが読み込まれている
    }
    /*
     * 中身が読めない（null）ときは src で見分ける。
     *   - https の URL … 別オリジンのクリエイティブが読み込まれている
     *   - src 無し（about:blank 等）… 空の枠
     * このページは sandbox（opaque origin）の中で動くため、Ad Generation が配信なしでも作る
     * 空の iframe の contentDocument も null になる。以前は null を一律「広告あり」とみなしていたため
     * 空枠で埋まったと誤認し、自社広告まで進まず枠が空のまま残っていた（2026-09-14）
     */
    if (!doc) return /^https?:/i.test(frame.getAttribute('src') || '');
    var body = doc.body;
    if (!body) return false;       // about:blank のまま（＝まだ何も入っていない）
    return rendered(body, depth + 1);
  }

  /* ------------------------------------------------------------------
     親（banner.html）への高さ通知
     ------------------------------------------------------------------ */

  function measure() {
    // 広告は iframe / img として非同期に差し込まれるため、
    // 実測値（getBoundingClientRect）とレイアウト値の大きい方を採用する
    var rect = slot.getBoundingClientRect();
    return Math.ceil(Math.max(rect.height, slot.scrollHeight));
  }

  /*
   * force = true のときは同じ高さでも送り直す。
   * 親（banner.html）側のスクリプトの読み込みが遅れていると
   * 最初の通知が受け取られないまま捨てられることがあるため、
   * しばらくの間は定期的に同じ値を送り続けて取りこぼしを防ぐ。
   *
   * 広告が出るまで（settled が false の間）は何も送らない。
   * 空の枠に差し替わってしまうのを防ぐため。
   */
  function report(force) {
    if (!settled) return;
    var h = measure();
    if (h <= 0 || h > MAX_HEIGHT) return;
    if (h === lastSent && !force) return;
    lastSent = h;
    try {
      // このページは sandbox（opaque origin）の中で動くので location.origin は "null"。
      // 親（banner.html）は送り主の window で見分けるので、送信先は '*' でよい（中身は高さだけ）
      parent.postMessage({ type: 'smartgame-ad-slot-height', height: h }, '*');
    } catch (e) {
      /* 通知できなくても広告表示自体は継続する */
    }
  }

  function reportChange() { report(false); }

  /* 広告が出た。以降は高さの変化を親へ伝えていく */
  function settle() {
    if (settled) return;
    settled = true;
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = 0; }
    report(true);

    // 通知の取りこぼし対策と、遅れて実寸が変わる広告への追従を兼ねたポーリング
    var tries = 0;
    var timer = setInterval(function () {
      report(true);
      if (++tries >= 20) clearInterval(timer);
    }, 500);
  }

  /* ------------------------------------------------------------------
     ウォーターフォール
     ------------------------------------------------------------------ */

  function step() {
    if (settled) return;
    if (rendered(wrap)) { settle(); return; }
    if (Date.now() >= deadline) { advance(); return; }
    stepTimer = setTimeout(step, POLL_MS);
  }

  /* 今の事業者を見限って次へ進む（最後まで来たら自社広告） */
  function advance() {
    if (stepTimer) { clearTimeout(stepTimer); stepTimer = 0; }
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null;

    var net = NETWORKS[++index];
    var left = HOUSE_DEADLINE_MS - (Date.now() - startedAt);
    // 残り時間で試しても間に合わない事業者は飛ばす（ゲーム側が枠を畳む前に埋める）
    if (!net || left < POLL_MS * 2) { showHouseAd(); return; }

    // 最後の1社に賭ける段階になったら、自社広告の画像を裏で用意し始める
    if (index >= NETWORKS.length - 1) preloadHouseAd();

    if (net.mount) {
      wrap = document.createElement('div');
      wrap.className = 'ad-net';
      wrap.id = 'ad-net-' + net.key;
      slot.appendChild(wrap);
      try { net.mount(wrap); } catch (e) { /* 差し込めなければ次へ */ }
    } else {
      wrap = document.getElementById('ad-net-' + net.key);
      if (!wrap) { advance(); return; }
    }

    deadline = Date.now() + Math.min(net.wait, left);
    stepTimer = setTimeout(step, POLL_MS);
  }

  /* ------------------------------------------------------------------
     自社広告（最後の受け皿）
     ------------------------------------------------------------------ */

  var housePick = HOUSE_ADS[Math.floor(Math.random() * HOUSE_ADS.length)];
  var houseImg = null;
  var houseReady = false;
  var houseWanted = false;

  /*
   * 最後の事業者を試し始めた時点で画像を先読みしておく。
   * こうすると、どこからも配信されなかったときに待ち時間ゼロで切り替えられる。
   * 逆に上位で埋まったときは画像を一切読み込まない（通信量を無駄にしない）。
   */
  function preloadHouseAd() {
    if (houseImg || !housePick) return;
    houseImg = new Image(1280, 200);
    houseImg.alt = housePick.alt;
    houseImg.decoding = 'async';
    houseImg.addEventListener('load', function () {
      houseReady = true;
      if (houseWanted) placeHouseAd();
    });
    houseImg.src = housePick.img;
  }

  /*
   * 画像が読めなかったときは何も表示しない（＝高さを通知しないので、
   * 呼び出し元は今出ている広告をそのまま残す）。
   */
  function showHouseAd() {
    houseWanted = true;
    preloadHouseAd();
    if (houseReady) placeHouseAd();
  }

  function placeHouseAd() {
    if (settled || !houseImg) return;

    var link = document.createElement('a');
    link.className = 'house-ad';
    link.href = housePick.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.appendChild(houseImg);

    slot.textContent = '';   // 空だった広告タグの枠を置き換える
    wrap = null;
    slot.appendChild(link);
    settle();
  }

  /* ------------------------------------------------------------------
     開始
     ------------------------------------------------------------------ */

  // 広告タグは非同期に DOM を書き換えるので、変化を監視して都度通知する
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(reportChange).observe(slot);
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(reportChange).observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('load', reportChange);
  window.addEventListener('resize', reportChange);

  advance();   // 1社目（i-mobile）から試し始める
})();
