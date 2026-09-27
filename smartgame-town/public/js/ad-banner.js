/*
 * スマートゲーム 共通フッターバナー広告（スマホ表示時のみ）
 *
 * ページ下部に広告枠を固定表示する。広告タグ本体は同一オリジンの
 * iframe（/ad/banner.html）に隔離してあるため、このゲームの CSP は
 * default-src 'self' のまま一切ゆるめる必要がない。
 *
 * 広告の実寸は iframe から postMessage で受け取り CSS 変数 --ad-h に反映する。
 * レイアウト側は --ad-space（広告の高さ + セーフエリア）ぶんだけ縮む。
 *
 * 広告が GIVE_UP_MS 以内に出なければ枠を畳んで場所を返すが、iframe は捨てない。
 * ホーム画面に追加した Web アプリとして起動したときや、ゲームの起動処理でメインスレッドが
 * 長く塞がるときは、広告（自社広告を含む）が出るまで 8 秒を超えることがあり、
 * 以前はそこで枠ごと捨てていたため広告が一度も出なかった。いまは遅れて高さが届いたら畳んだ枠を開き直す。
 */
(function () {
  'use strict';

  var AD_URL = '/ad/banner.html';
  var MOBILE_QUERY = '(max-width: 767px)';
  var DEFAULT_HEIGHT = 50;   // 広告が届くまでに確保しておく高さ
  var MAX_HEIGHT = 320;      // 想定外に大きな広告でゲーム画面が潰れるのを防ぐ
  var GIVE_UP_MS = 8000;     // この時間内に広告が表示されなければ枠を畳む（iframe は残し、遅れて出たら開き直す）
  var GRACE_MS = 4000;       // タイマーが大きく遅れて発火した（＝メインスレッドが塞がっていた）ときに追加で待つ時間
  var RECHECK_MS = 1000;     // 画面切り替え等でレイアウトが変わったときの再計算間隔

  if (!window.matchMedia) return;

  var root = document.documentElement;
  var mql = window.matchMedia(MOBILE_QUERY);
  var container = null;
  var frame = null;
  var giveUpTimer = 0;
  var gotAd = false;
  var collapsed = false;     // 広告が間に合わず枠を畳んでいる（iframe は生きている）
  var mountedAt = 0;         // 枠を作った時刻（performance.now）
  var currentHeight = 0;     // いま --ad-h に入れている高さ（同じ高さなら resize を発火しない）
  // <body data-ad-layout="fixed"> のページ（農場など）は --ad-space で画面全体を縮めるため、DOM 監視と本文の余白計算は不要
  var fixedLayout = document.body.getAttribute('data-ad-layout') === 'fixed';
  var padTarget = null;      // 広告ぶんの余白を足した要素
  var padOriginal = '';      // その要素の元の inline padding-bottom
  var padApplied = 0;        // 実際に足した px

  /* ------------------------------------------------------------------
     スクロールするページで最下部のコンテンツが広告に隠れないようにする。

     body に padding を足すだけでは足りない。ほとんどのゲームが
     html, body { height: 100% } を指定しており body の箱が伸びないため、
     はみ出している要素そのものに padding を入れてスクロール範囲を広げる。
     ------------------------------------------------------------------ */
  function clearanceTarget() {
    var best = null, bestBottom = -Infinity;
    // 一番下まで伸びている枝だけを辿る（下端を決めている要素まで降りる）
    function walk(parent) {
      var kids = parent.children;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el === container) continue;
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.position === 'fixed') continue;
        var rect = el.getBoundingClientRect();
        if (rect.height < 1) continue;
        if (rect.bottom >= bestBottom - 0.5) {
          // インライン要素は padding-bottom を足しても高さが変わらないので対象外
          if (cs.display !== 'inline' && cs.display !== 'contents') {
            bestBottom = rect.bottom;
            best = el;
          }
          walk(el);
        }
      }
    }
    walk(document.body);
    return best;
  }

  function scrollTop() {
    // overflow 指定によっては html ではなく body 側がスクロールコンテナになる
    return window.pageYOffset || root.scrollTop || document.body.scrollTop || 0;
  }

  function docHeight() {
    return Math.max(root.scrollHeight, document.body.scrollHeight, root.clientHeight);
  }

  function applyClearance() {
    // いったん自分が足した余白を外し、素の状態で測り直す
    if (padTarget) {
      padTarget.style.paddingBottom = padOriginal;
      padTarget = null;
      padOriginal = '';
      padApplied = 0;
    }
    if (!container || fixedLayout) return;

    var space = collapsed ? 0 : container.offsetHeight;
    var target = clearanceTarget();
    if (!target || !space) return;

    // ドキュメント座標での「一番下のコンテンツの下端」が、
    // 一番下までスクロールしたときの広告の上端より下なら余白が要る。
    // 下端は要素自身の padding-bottom を除いた中身で測る（ゲーム側が CSS で --ad-space ぶんの余白を
    // すでに取っているとき、さらに広告の高さを足して二重に空けないように）
    var current = parseFloat(window.getComputedStyle(target).paddingBottom) || 0;
    var contentBottom = target.getBoundingClientRect().bottom - current + scrollTop();
    if (contentBottom <= docHeight() - space + 0.5) return;

    padTarget = target;
    padOriginal = target.style.paddingBottom;
    padApplied = space;
    target.style.paddingBottom = (current + space) + 'px';
  }

  function setHeight(px) {
    if (px === currentHeight) return;
    currentHeight = px;
    root.style.setProperty('--ad-h', px + 'px');
    applyClearance();
    // ビューポート高からレイアウトを算出しているゲームに再計算の機会を与える
    window.dispatchEvent(new Event('resize'));
  }

  function mount() {
    if (container) return;
    giveUp.waited = false;

    frame = document.createElement('iframe');
    frame.className = 'ad-banner__frame';
    frame.title = '広告';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = AD_URL;
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('frameborder', '0');

    container = document.createElement('div');
    container.className = 'ad-banner';
    container.appendChild(frame);

    document.body.appendChild(container);
    root.classList.add('has-ad-banner');
    setHeight(DEFAULT_HEIGHT);
    startObserving();

    // 広告が配信されなかったときに空の帯が残り続けないようにする
    mountedAt = now();
    giveUpTimer = setTimeout(giveUp, GIVE_UP_MS);
  }

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  /* GIVE_UP_MS が過ぎた。タイマーが大きく遅れて発火したなら（起動処理でメインスレッドが塞がっていた）、
     広告タグ側もそのぶん進めていないので、一度だけ GRACE_MS 待ってから畳む */
  function giveUp() {
    giveUpTimer = 0;
    if (gotAd) return;
    if (now() - mountedAt > GIVE_UP_MS + GRACE_MS && !giveUp.waited) {
      giveUp.waited = true;
      giveUpTimer = setTimeout(giveUp, GRACE_MS);
      return;
    }
    collapse();
  }

  /* 枠を畳んで場所を返す（iframe は残す。遅れて広告が出たら expand() で開き直す）。
     display: none にはしない：広告枠は自分の大きさを測って高さを通知するので、レイアウトから外すと測れず（高さ 0）、
     開き直す通知が永久に来なくなる。高さ 0・visibility: hidden でレイアウトだけ残す */
  function collapse() {
    if (!container || collapsed) return;
    collapsed = true;
    currentHeight = 0;
    stopObserving();
    container.style.height = '0px';
    container.style.paddingBottom = '0';
    container.style.visibility = 'hidden';
    container.style.boxShadow = 'none';
    root.classList.remove('has-ad-banner');
    root.style.removeProperty('--ad-h');
    applyClearance();
    window.dispatchEvent(new Event('resize'));
  }

  function expand() {
    if (!container || !collapsed) return;
    collapsed = false;
    container.style.height = '';
    container.style.paddingBottom = '';
    container.style.visibility = '';
    container.style.boxShadow = '';
    root.classList.add('has-ad-banner');
    startObserving();
  }

  function unmount() {
    if (giveUpTimer) { clearTimeout(giveUpTimer); giveUpTimer = 0; }
    if (!container) return;
    stopObserving();
    if (container.parentNode) container.parentNode.removeChild(container);
    container = null;
    frame = null;
    gotAd = false;
    collapsed = false;
    currentHeight = 0;
    root.classList.remove('has-ad-banner');
    root.style.removeProperty('--ad-h');
    applyClearance();
    window.dispatchEvent(new Event('resize'));
  }

  window.addEventListener('message', function (ev) {
    // 広告枠は同一オリジン（/ad/banner.html）。別オリジンからの通知は受け取らない
    if (ev.origin !== window.location.origin) return;
    if (!frame || ev.source !== frame.contentWindow) return;
    var data = ev.data;
    if (!data || data.type !== 'smartgame-ad-height' || typeof data.height !== 'number') return;
    var h = Math.round(data.height);
    if (!isFinite(h) || h <= 0 || h > MAX_HEIGHT) return;
    gotAd = true;
    if (giveUpTimer) { clearTimeout(giveUpTimer); giveUpTimer = 0; }
    expand();   // 間に合わずに畳んでいたら開き直す
    setHeight(Math.max(h, DEFAULT_HEIGHT));
  });

  /**
   * 広告枠が実際に占有している高さ（px）。広告非表示なら 0。
   * CSS ではなく JS でビューポート高からレイアウトを組むゲーム用。
   * 高さが変わるたびに resize イベントを発火するので、
   * ゲーム側は resize ハンドラ内でこの値を引けばよい。
   */
  window.smartgameAdSpace = function () {
    return (container && !collapsed) ? container.offsetHeight : 0;
  };

  function sync() {
    if (mql.matches) mount();
    else unmount();
  }

  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', sync);
  else if (typeof mql.addListener === 'function') mql.addListener(sync);

  window.addEventListener('resize', applyClearance);
  window.addEventListener('orientationchange', applyClearance);

  /* タイトル画面 → ゲーム画面のようにページの高さが変わったときの再計算。
     ゲームは毎フレーム DOM を書き換えるため、
       - 監視は広告枠がある間だけ（PC表示・広告非配信時はコストをゼロにする）
       - 通知は間引いてから計測
       - 実際にレイアウトが変わっていなければ測り直さない
     の3段構えで、毎秒の強制リフローを避ける */
  var recheckTimer = 0;
  var observer = null;
  var lastDocH = -1, lastViewH = -1, lastAdH = -1;

  function layoutChanged() {
    var dh = docHeight(), vh = window.innerHeight, ah = (container && !collapsed) ? container.offsetHeight : 0;
    if (dh === lastDocH && vh === lastViewH && ah === lastAdH) return false;
    lastDocH = dh; lastViewH = vh; lastAdH = ah;
    return true;
  }

  function recheck() {
    if (!container || !layoutChanged()) return;
    applyClearance();
    // 余白を足したぶんドキュメント高が変わるので、基準値を取り直す
    lastDocH = docHeight();
  }

  function scheduleRecheck() {
    if (!container || recheckTimer) return;
    recheckTimer = setTimeout(function () {
      recheckTimer = 0;
      recheck();
    }, RECHECK_MS);
  }

  function startObserving() {
    if (fixedLayout || observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(scheduleRecheck);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserving() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    if (recheckTimer) { clearTimeout(recheckTimer); recheckTimer = 0; }
    lastDocH = lastViewH = lastAdH = -1;
  }

  sync();
})();
