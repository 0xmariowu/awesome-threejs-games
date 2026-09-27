/*
 * スマートゲーム 共通ヘッダー（全ゲーム共通・上部固定）
 *
 * 読み込み方（各ゲームの index.html）:
 *   <link rel="stylesheet" href="/css/sg-header.css?ver=...">   ← style.css より後
 *   <script src="/js/sg-header.js?ver=..." defer
 *           data-sgh-game="minesweeper"
 *           data-sgh-menu='[{"k":"ranking","sel":"#btn-ranking","hide":1}, ...]'></script>
 *
 * data-sgh-menu の各要素:
 *   k    … 項目の種類（下の MENU_DEFS のキー）
 *   sel  … そのゲーム側の既存ボタンのセレクタ。押すとこのボタンを click する
 *   hide … 1 ならゲーム側の元ボタンを隠す（共通ヘッダーに集約する）
 *   name / icon … 省略可。表示名・アイコンを変えたいとき（例: タウンの home を「広場へ戻る」に）
 *
 * パネルを開いている間（2026-09-24）:
 *   - キー入力・ポインタ操作はゲームへ渡さない（パネルの操作で裏のゲームが動かないように）。
 *     Esc はパネルを閉じるだけで、ゲーム側の Esc（ポーズの切り替え等）には届かない
 *   - <html> に sgh-panel-open クラスを付け、document に CustomEvent 'sgh:panel'
 *     （detail: {open: true/false, side: 'left'|'right'}）を送る。リアルタイムのゲームはこれで一時停止できる
 *
 * ゲーム側のロジックには一切手を入れず、既存ボタンを呼び出す方式にしている。
 * アイコン（🔊/🔇 など）は元ボタンの表示を監視してそのまま反映する。
 *
 * メニューの最後には、そのゲームを選んだ状態で開く
 * 「このゲームの不具合報告をする」（/contact/?g=<ディレクトリ名>）を必ず出す。
 *
 * スマゲータウン（/town/）から開いたゲームでは（2026-09-07）:
 *   タウンが localStorage の smartgame:town-return に {t, d: ディレクトリ, body: 在室} を控えて移ってくる。
 *   d がこのゲームで t が新しければ、左上のロゴを「スマゲータウンに戻る」（/town/ へのリンク）にし、
 *   body を /town/api.php へ TOWN_HB_MS ごとに送り続ける（タウンの中で、その人のアバターが筐体の前に
 *   「🎮 ゲームプレイ中」として残る。送るのをやめると 3 分で消える）。タウンへ戻ると控えを読んで筐体の前から再開する。
 *   タウン以外から開いたときは何もしない
 *
 * アカウント（/account/。2026-09-09）:
 *   左パネルの先頭に、ログイン状態（ゲスト／ニックネーム）とアカウントページへの導線を出す。
 *   まず localStorage の控え（smartgame:account）で描き、パネルを開いたときに 1 回だけ /account/api.php?a=me で確かめて直す
 */
(function () {
  'use strict';

  // ?ver= は top/index.html・top/mypage/index.html の games.js と必ず揃える
  // （ずれると同じファイルを2回ダウンロードすることになる）
  // 【重要】games.js を更新してここを上げたら、各ゲームの index.html が読む
  // sg-header.js?ver= も同じ値に上げること。共有JSは immutable キャッシュなので、
  // ゲーム側の ver が古いままだと旧 sg-header.js（＝旧 CATALOG_URL）が配られ続け、
  // 追加したゲームが「関連するゲーム」等に一切出てこなくなる
  var CATALOG_URL = '/js/games.js?ver=20260907-1';
  var TOP_URL = '/';
  var MYPAGE_URL = '/mypage/';
  var CONTACT_URL = '/contact/';   // お問い合わせ・不具合報告フォーム（?g= で対象ゲームを指定する）
  var ACCOUNT_URL = '/account/';   // アカウント（サイト全体で共通のログイン。2026-09-09）
  var ACCOUNT_API = '/account/api.php';
  var LS_ACCOUNT = 'smartgame:account';   // ログイン中の控え {id, name, t}（/js/sg-account.js と同じ形。正はサーバー）
  var LS_RECENT = 'smartgame:recent';    // 旧形式（ディレクトリ名だけの配列）。互換のため書き続ける
  var LS_HISTORY = 'smartgame:history';  // プレイ履歴 [{d:ディレクトリ, t:最終プレイ時刻(秒), n:回数}]
  var LS_FAV = 'smartgame:favorites';
  var MAX_RECENT = 12;
  var MAX_HISTORY = 60;  // マイページのプレイ履歴に残す件数
  var SESSION_SEC = 1800; // 同じゲームを30分以内に開き直しただけなら回数は増やさない
  var MAX_FAV = 200;   // お気に入りの保持上限（マイページ側の上限と揃える）
  var LIST_LIMIT = 4;
  var DIR_RE = /^[a-z0-9][a-z0-9-]{0,39}$/i;
  var TOWN_URL = '/town/';
  var TOWN_API = '/town/api.php';
  var LS_TOWN_RETURN = 'smartgame:town-return';   // スマゲータウンが書く（town/src/state/store.js の readReturn と同じ形）
  var TOWN_RETURN_SEC = 6 * 3600;                 // これより古い控えは無視する（タウン側と同じ）
  var TOWN_HB_MS = 30000;                         // ゲームプレイ中の在室を送る間隔（タウンの受け口は 180 秒で消す）

  var MENU_DEFS = {
    ranking:    { icon: '🏆', name: '全国ランキング' },
    sound:      { icon: '🔊', name: 'サウンド', mirror: true },
    howto:      { icon: '❓', name: '遊び方' },
    settings:   { icon: '⚙️', name: '設定・メニュー' },
    restart:    { icon: '🔄', name: 'はじめから' },
    home:       { icon: '🚩', name: 'タイトルへ戻る' },
    difficulty: { icon: '🎚️', name: '難易度を変える' }
  };

  var script = document.currentScript;
  if (!script) {
    var all = document.querySelectorAll('script[data-sgh-game]');
    script = all[all.length - 1];
  }
  if (!script) return;

  var GAME = (script.getAttribute('data-sgh-game') || '').trim();
  var MENU = parseJson(script.getAttribute('data-sgh-menu')) || [];
  if (!DIR_RE.test(GAME)) return;

  var catalog = null;         // { dir: {name, icon, genres} }
  var catalogState = 'idle';  // idle | loading | ready | error
  var catalogWaiters = [];
  var openPanel = null;       // { el, backdrop, trigger, observers }
  var panelObservers = null;  // 構築中パネルが張った MutationObserver の置き場

  /* ---------------- localStorage（破損・改ざんを前提に検証する） ---------------- */

  function parseJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /* 上限は用途ごとに違う。お気に入りは MAX_FAV（= /favorites/ と同じ）まで保持する。
     ここで切り詰めた値がそのまま書き戻されるため、上限を小さくすると
     登録済みのお気に入りが黙って消えてしまう点に注意する */
  function readDirList(key, limit) {
    var raw;
    try { raw = window.localStorage.getItem(key); } catch (e) { return []; }
    var list = parseJson(raw);
    if (!Array.isArray(list)) return [];
    var max = limit || MAX_RECENT * 2;
    var out = [];
    for (var i = 0; i < list.length && out.length < max; i++) {
      var v = list[i];
      if (typeof v === 'string' && DIR_RE.test(v) && out.indexOf(v) === -1) out.push(v);
    }
    return out;
  }

  function writeDirList(key, list) {
    try { window.localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* 容量超過等は無視 */ }
  }

  /* プレイ履歴（マイページ用）。1件 = {d:ディレクトリ, t:最終プレイ時刻(秒), n:プレイ回数}。
     新しい順に並べる。壊れた値・巨大な値はここで落とす */
  function readHistory() {
    var raw;
    try { raw = window.localStorage.getItem(LS_HISTORY); } catch (e) { return []; }
    var list = parseJson(raw);
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length && out.length < MAX_HISTORY; i++) {
      var v = list[i];
      if (!v || typeof v !== 'object') continue;
      var dir = v.d;
      if (typeof dir !== 'string' || !DIR_RE.test(dir) || seen[dir]) continue;
      var t = (typeof v.t === 'number' && isFinite(v.t) && v.t > 0) ? Math.floor(v.t) : 0;
      var n = (typeof v.n === 'number' && isFinite(v.n) && v.n >= 1) ? Math.floor(v.n) : 1;
      seen[dir] = true;
      out.push({ d: dir, t: t, n: Math.min(n, 999999) });
    }
    return out;
  }

  function writeHistory(list) {
    try { window.localStorage.setItem(LS_HISTORY, JSON.stringify(list.slice(0, MAX_HISTORY))); } catch (e) { /* 容量超過等は無視 */ }
  }

  function rememberVisit() {
    var list = readDirList(LS_RECENT);
    var i = list.indexOf(GAME);
    if (i !== -1) list.splice(i, 1);
    list.unshift(GAME);
    writeDirList(LS_RECENT, list.slice(0, MAX_RECENT));

    var now = Math.floor(Date.now() / 1000);
    var hist = readHistory();
    // 履歴がまだ無い端末は、旧形式（smartgame:recent）の並びを時刻なしで引き継ぐ
    if (!hist.length && list.length > 1) {
      for (var k = 1; k < list.length; k++) hist.push({ d: list[k], t: 0, n: 1 });
    }
    var cur = null;
    for (var j = 0; j < hist.length; j++) {
      if (hist[j].d === GAME) { cur = hist.splice(j, 1)[0]; break; }
    }
    if (!cur) {
      cur = { d: GAME, t: now, n: 1 };
    } else {
      // 開き直し（リロード等）を1プレイと数えないよう、30分以内は回数を増やさない
      if (now - cur.t >= SESSION_SEC) cur.n += 1;
      cur.t = now;
    }
    hist.unshift(cur);
    writeHistory(hist);
  }

  function recentDirs() {
    var hist = readHistory();
    if (hist.length) {
      var out = [];
      for (var i = 0; i < hist.length; i++) out.push(hist[i].d);
      return out;
    }
    return readDirList(LS_RECENT);
  }

  function readFavs() {
    return readDirList(LS_FAV, MAX_FAV);
  }

  function isFavorite() {
    return readFavs().indexOf(GAME) !== -1;
  }

  function toggleFavorite() {
    var list = readFavs();
    var i = list.indexOf(GAME);
    if (i === -1) list.unshift(GAME); else list.splice(i, 1);
    writeDirList(LS_FAV, list.slice(0, MAX_FAV));
    return i === -1;
  }

  /* ---------------- ゲームカタログ（/js/games.js）は開いたときに初めて読む ---------------- */

  function loadCatalog(done) {
    if (catalogState === 'ready' || catalogState === 'error') { done(catalog); return; }
    catalogWaiters.push(done);
    if (catalogState === 'loading') return;
    catalogState = 'loading';

    var s = document.createElement('script');
    s.src = CATALOG_URL;
    s.async = true;
    s.onload = function () {
      var data = window.SMARTGAME_GAMES;
      catalog = (data && typeof data === 'object') ? data : null;
      catalogState = catalog ? 'ready' : 'error';
      flushWaiters();
    };
    s.onerror = function () {
      catalogState = 'error';
      flushWaiters();
    };
    document.head.appendChild(s);
  }

  function flushWaiters() {
    var list = catalogWaiters;
    catalogWaiters = [];
    for (var i = 0; i < list.length; i++) list[i](catalog);
  }

  function entry(dir) {
    // catalog[dir] を直接引くと "constructor" 等がプロトタイプ側に当たってしまうため
    // 自前のキーだけを見る（localStorage の値は改ざんされうる）
    var e = (catalog && Object.prototype.hasOwnProperty.call(catalog, dir)) ? catalog[dir] : null;
    if (!e || typeof e.name !== 'string') return null;
    // カタログのアイコンパスはトップページ基準の相対パスなのでルート基準に直す
    var icon = typeof e.icon === 'string' ? e.icon : '';
    if (icon && icon.charAt(0) !== '/') icon = '/' + icon;
    return { dir: dir, name: e.name, icon: icon, genres: Array.isArray(e.genres) ? e.genres : [] };
  }

  /* 関連ゲームはページ内の静的リンク（nav.sgh-related）から読む。
     以前はここで games.js から実行時に組み立てていたが、それだとゲームページの
     HTML に内部リンクが1本も残らず、検索エンジンがゲーム間を辿れなかった。
     いまは /top/tools/gen-sgh-static.js が各 index.html に書き出している
     （ジャンル一致度の計算は下の relatedGamesFromGenres() と同じもの）。 */
  function staticRelated() {
    var links = document.querySelectorAll('nav.sgh-related a.sgh-related__item');
    var out = [];
    for (var i = 0; i < links.length && out.length < LIST_LIMIT; i++) {
      var a = links[i];
      // href は "/dir/" 形式。属性値そのものを見る（絶対URLに解決させない）
      var m = /^\/([^/?#]+)\/$/.exec(a.getAttribute('href') || '');
      var nameNode = a.querySelector('.sgh-related__name');
      if (!m || !nameNode) continue;
      var img = a.querySelector('img');
      out.push({
        dir: m[1],
        name: nameNode.textContent,
        icon: img ? (img.getAttribute('src') || '') : '',
        genres: []
      });
    }
    return out;
  }

  /* 静的リンクが無いページ（生成前・トップページ等）は従来どおり計算で出す */
  function relatedGames() {
    var fromHtml = staticRelated();
    if (fromHtml.length) return fromHtml;
    return relatedGamesFromGenres();
  }

  /* 関連ゲーム: ジャンルの一致度で選ぶ。よくあるジャンル（定番ゲーム等）は
     重みを下げて、より特徴の近いゲームが上に来るようにする */
  function relatedGamesFromGenres() {
    var me = entry(GAME);
    if (!me || !me.genres.length) return [];

    var freq = {};
    var dir;
    for (dir in catalog) {
      var g = entry(dir);
      if (!g) continue;
      for (var i = 0; i < g.genres.length; i++) {
        freq[g.genres[i]] = (freq[g.genres[i]] || 0) + 1;
      }
    }

    var scored = [];
    for (dir in catalog) {
      if (dir === GAME) continue;
      var other = entry(dir);
      if (!other) continue;
      var score = 0;
      for (var j = 0; j < me.genres.length; j++) {
        var tag = me.genres[j];
        if (other.genres.indexOf(tag) !== -1) score += 1 / (freq[tag] || 1);
      }
      if (score > 0) scored.push({ game: other, score: score });
    }
    scored.sort(function (a, b) {
      return b.score - a.score || (a.game.dir < b.game.dir ? -1 : 1);
    });
    return scored.slice(0, LIST_LIMIT).map(function (x) { return x.game; });
  }

  /* ---------------- DOM ヘルパー ---------------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function gameRow(game) {
    var a = el('a', 'sgh-item');
    a.href = '/' + game.dir + '/';

    var img = document.createElement('img');
    img.className = 'sgh-item__thumb';
    // src が空だとページ自身を読みに行ってしまうので、アイコンが無い場合は付けない
    if (game.icon) img.src = game.icon;
    img.alt = '';
    img.width = 34;
    img.height = 34;
    img.loading = 'lazy';
    img.decoding = 'async';
    a.appendChild(img);

    var body = el('div', 'sgh-item__body');
    body.appendChild(el('span', 'sgh-item__name', game.name));
    a.appendChild(body);
    return a;
  }

  function actionRow(icon, name, note, onClick) {
    var b = el('button', 'sgh-item');
    b.type = 'button';
    b.appendChild(el('span', 'sgh-item__icon', icon));
    var body = el('div', 'sgh-item__body');
    body.appendChild(el('span', 'sgh-item__name', name));
    if (note) body.appendChild(el('span', 'sgh-item__note', note));
    b.appendChild(body);
    b.addEventListener('click', onClick);
    return b;
  }

  function sectionLabel(text) {
    return el('div', 'sgh-panel__label', text);
  }

  /* ---------------- パネルの開閉 ---------------- */

  function closePanel() {
    if (!openPanel) return;
    var p = openPanel;
    openPanel = null;
    // パネルを開くたびに張った MutationObserver を必ず外す（開閉のたびに溜まるため）
    for (var i = 0; i < p.observers.length; i++) p.observers[i].disconnect();
    // パネルへ移した静的ブロック（div.sgh-about）は、パネルごと消えないように本文へ戻す
    var about = p.el.querySelector('.sgh-about');
    if (about) document.body.appendChild(about);
    if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
    if (p.backdrop.parentNode) p.backdrop.parentNode.removeChild(p.backdrop);
    p.trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('sgh-panel-open');
    emitPanel(false, p.side);
  }

  function emitPanel(open, side) {
    try {
      document.dispatchEvent(new CustomEvent('sgh:panel', { detail: { open: open, side: side } }));
    } catch (e) { /* CustomEvent が使えない古いブラウザでは知らせない */ }
  }

  /* ヘッダー・パネル・背景幕の上のポインタ操作を、window / document で入力を受けるゲームへ伝えない
     （メニューを押した位置でゲームの操作が起きないように）。離す側（pointerup 等）は止めない
     （ゲームのドラッグ中にヘッダーの上で指を離したとき、ドラッグが終わらなくなるため） */
  function isolatePointer(node, withClick) {
    var types = ['pointerdown', 'mousedown', 'touchstart', 'wheel'];
    if (withClick) types.push('click');
    for (var i = 0; i < types.length; i++) {
      node.addEventListener(types[i], stopEvent, (types[i] === 'touchstart' || types[i] === 'wheel') ? { passive: true } : false);
    }
  }

  function stopEvent(ev) { ev.stopPropagation(); }

  function showPanel(side, trigger, build) {
    var wasOpen = openPanel && openPanel.trigger === trigger;
    closePanel();
    if (wasOpen) return;

    var backdrop = el('button', 'sgh-backdrop');
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'メニューを閉じる');
    backdrop.addEventListener('click', function () {
      closePanel();
      trigger.focus();
    });

    var panel = el('div', 'sgh-panel sgh-panel--' + side);
    panel.id = trigger.getAttribute('aria-controls');
    panelObservers = [];
    build(panel);
    isolatePointer(backdrop, true);
    isolatePointer(panel, true);
    panel.addEventListener('keydown', stopEvent);

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    trigger.setAttribute('aria-expanded', 'true');
    openPanel = { el: panel, backdrop: backdrop, trigger: trigger, observers: panelObservers, side: side };
    panelObservers = null;
    document.documentElement.classList.add('sgh-panel-open');
    emitPanel(true, side);

    var first = panel.querySelector('.sgh-item');
    if (first) first.focus();
  }

  /* パネル表示中のキー。window の capture で最初に受ける（ゲームの keydown より先に閉じ、同じ Esc を渡さない）。
     パネルの中で起きたキー（Tab・Enter・Space・矢印でのスクロール）はブラウザ標準の動作に任せ、panel の stopEvent で
     ゲームへ届く手前で止める。フォーカスが外（body など）にあるときのキーはここで止める。keyup は止めない
     （開く前から押していたキーを離したことがゲームに伝わらず、押しっぱなしになるのを防ぐ） */
  window.addEventListener('keydown', function (ev) {
    if (!openPanel) return;
    if (ev.key === 'Escape') {
      var trigger = openPanel.trigger;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      closePanel();
      trigger.focus();
      return;
    }
    if (!openPanel.el.contains(ev.target)) ev.stopImmediatePropagation();
  }, true);

  /* ---------------- 左パネル（サイト内の回遊） ---------------- */

  function buildSitePanel(panel) {
    var home = el('a', 'sgh-item sgh-item--home');
    home.href = TOP_URL;
    home.appendChild(el('span', 'sgh-item__icon', '🏠'));
    var homeBody = el('div', 'sgh-item__body');
    homeBody.appendChild(el('span', 'sgh-item__name', 'トップページへ戻る'));
    homeBody.appendChild(el('span', 'sgh-item__note', 'スマートゲームのゲーム一覧'));
    home.appendChild(homeBody);
    panel.appendChild(home);
    panel.appendChild(accountRow());

    var slot = el('div', 'sgh-panel__slot');
    panel.appendChild(slot);
    slot.appendChild(el('div', 'sgh-panel__empty', '読み込み中…'));

    loadCatalog(function () {
      slot.textContent = '';
      if (!catalog) {
        slot.appendChild(el('div', 'sgh-panel__empty', 'ゲーム一覧を読み込めませんでした'));
        return;
      }
      addList(slot, '関連するゲーム', relatedGames(), '該当するゲームがありません');
      addList(slot, '最近プレイしたゲーム', pickGames(recentDirs(), true), 'まだありません');

      var favDirs = readFavs();
      addList(slot, 'お気に入り', pickGames(favDirs, false), 'まだありません');
      slot.appendChild(myPageRow(favDirs.length));
    });
  }

  /* ---------------- アカウント（/account/） ---------------- */

  var accountState = null;     // {id, name} | null（ゲスト）
  var accountChecked = false;  // このページで一度サーバーに確かめたか

  function readAccountHint() {
    var raw;
    try { raw = window.localStorage.getItem(LS_ACCOUNT); } catch (e) { return null; }
    var v = parseJson(raw);
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !/^[0-9a-f]{12}$/.test(v.id) || typeof v.name !== 'string') return null;
    return { id: v.id, name: v.name.slice(0, 10) };
  }

  function writeAccountHint(u) {
    try {
      if (u) window.localStorage.setItem(LS_ACCOUNT, JSON.stringify({ id: u.id, name: u.name, t: Math.floor(Date.now() / 1000) }));
      else window.localStorage.removeItem(LS_ACCOUNT);
    } catch (e) { /* ignore */ }
  }

  function paintAccountRow(row) {
    var u = accountState;
    row.querySelector('.sgh-item__name').textContent = u ? (u.name || 'アカウント') : 'ゲストで遊んでいます';
    row.querySelector('.sgh-item__note').textContent = u ? 'ログイン中 ・ アカウント設定' : 'ログイン／新規登録（Google・LINE・X・Discord・メール）';
    row.classList.toggle('sgh-item--on', !!u);
  }

  /* ログイン状態の行。控えで描いてから、サーバーに 1 回だけ確かめて描き直す */
  function accountRow() {
    if (!accountChecked) accountState = readAccountHint();
    var a = el('a', 'sgh-item sgh-item--account');
    a.href = ACCOUNT_URL + '?back=' + encodeURIComponent('/' + GAME + '/');
    a.appendChild(el('span', 'sgh-item__icon', '👤'));
    var body = el('div', 'sgh-item__body');
    body.appendChild(el('span', 'sgh-item__name', ''));
    body.appendChild(el('span', 'sgh-item__note', ''));
    a.appendChild(body);
    paintAccountRow(a);
    if (!accountChecked && typeof window.fetch === 'function') {
      accountChecked = true;
      window.fetch(ACCOUNT_API + '?a=me', { credentials: 'same-origin', cache: 'no-store' }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (json) {
        if (!json || typeof json !== 'object' || !json.ok) return;
        var u = json.user;
        accountState = (u && typeof u === 'object' && typeof u.id === 'string' && /^[0-9a-f]{12}$/.test(u.id))
          ? { id: u.id, name: typeof u.name === 'string' ? u.name.slice(0, 10) : '' } : null;
        writeAccountHint(accountState);
        if (a.parentNode) paintAccountRow(a);
      }).catch(function () { /* 通信できなければ控えのまま */ });
    }
    return a;
  }

  /* マイページ（/mypage/）への導線。お気に入り・ランキング記録・プレイ履歴をまとめてある */
  function myPageRow(favCount) {
    var a = el('a', 'sgh-item sgh-item--all');
    a.href = MYPAGE_URL;
    a.appendChild(el('span', 'sgh-item__icon', '⭐'));
    var body = el('div', 'sgh-item__body');
    body.appendChild(el('span', 'sgh-item__name', 'マイページ'));
    body.appendChild(el('span', 'sgh-item__note',
      favCount ? 'お気に入り' + favCount + '件・ランキング記録・プレイ履歴' : 'お気に入り・ランキング記録・プレイ履歴'));
    a.appendChild(body);
    return a;
  }

  function pickGames(dirs, excludeSelf) {
    var out = [];
    for (var i = 0; i < dirs.length && out.length < LIST_LIMIT; i++) {
      if (excludeSelf && dirs[i] === GAME) continue;
      var g = entry(dirs[i]);
      if (g) out.push(g);
    }
    return out;
  }

  function addList(parent, title, games, emptyText) {
    parent.appendChild(el('div', 'sgh-panel__hr'));
    parent.appendChild(sectionLabel(title));
    if (!games.length) {
      parent.appendChild(el('div', 'sgh-panel__empty', emptyText));
      return;
    }
    for (var i = 0; i < games.length; i++) parent.appendChild(gameRow(games[i]));
  }

  /* ---------------- 右パネル（このゲームのメニュー） ---------------- */

  function buildGamePanel(panel) {
    /* ゲームのアイコンと説明文は index.html に書き出してある（/top/tools/gen-sgh-static.js）。
       JS で作り直さず、その要素をそのままパネルへ移して見せる。
       閉じるときに closePanel() が本文へ戻すので、開き直しても残る */
    var about = document.querySelector('.sgh-about');
    if (about) panel.appendChild(about);

    panel.appendChild(sectionLabel('このゲーム'));

    var fav = actionRow(isFavorite() ? '★' : '☆', 'お気に入り', null, function () {
      var on = toggleFavorite();
      fav.querySelector('.sgh-item__icon').textContent = on ? '★' : '☆';
      fav.querySelector('.sgh-item__state').textContent = on ? '登録済み' : '未登録';
      fav.classList.toggle('sgh-item--on', on);
    });
    fav.classList.add('sgh-item--fav');
    if (isFavorite()) fav.classList.add('sgh-item--on');
    var state = el('span', 'sgh-item__state', isFavorite() ? '登録済み' : '未登録');
    fav.appendChild(state);
    panel.appendChild(fav);

    var added = 0;
    for (var i = 0; i < MENU.length; i++) {
      var row = nativeRow(MENU[i]);
      if (row) { panel.appendChild(row); added++; }
    }
    if (!added) {
      panel.appendChild(el('div', 'sgh-panel__empty', 'このゲームの操作メニューはありません'));
    }

    // 不具合報告・ご意見（/contact/）。このゲームを選んだ状態でフォームが開く
    panel.appendChild(el('div', 'sgh-panel__hr'));
    panel.appendChild(reportRow());
  }

  /* お問い合わせフォームへの導線。ゲーム側のボタンではなくページ移動なので <a> で作る */
  function reportRow() {
    var a = el('a', 'sgh-item sgh-item--report');
    a.href = CONTACT_URL + '?g=' + encodeURIComponent(GAME) + '&kind=bug';
    a.appendChild(el('span', 'sgh-item__icon', '🐞'));
    var body = el('div', 'sgh-item__body');
    body.appendChild(el('span', 'sgh-item__name', 'このゲームの不具合報告をする'));
    body.appendChild(el('span', 'sgh-item__note', 'ご意見・ご要望もこちらから'));
    a.appendChild(body);
    return a;
  }

  function nativeRow(item) {
    if (!item || typeof item.sel !== 'string') return null;
    var def = MENU_DEFS[item.k];
    if (!def) return null;
    var native = document.querySelector(item.sel);
    if (!native) return null;

    var icon = (typeof item.icon === 'string' && item.icon && item.icon.length <= 4) ? item.icon : def.icon;
    var name = (typeof item.name === 'string' && item.name && item.name.length <= 20) ? item.name : def.name;
    var row = actionRow(icon, name, null, function () {
      closePanel();
      // パネルを閉じてからゲーム側のボタンを押す（モーダルが背面に出ないように）
      window.setTimeout(function () { native.click(); }, 0);
    });

    if (def.mirror) mirrorIcon(native, row.querySelector('.sgh-item__icon'));
    return row;
  }

  /* 元ボタンの表示（🔊 / 🔇 など）をメニュー側に反映し続ける */
  function mirrorIcon(native, iconEl) {
    var apply = function () {
      var text = (native.textContent || '').trim();
      if (text && text.length <= 4) iconEl.textContent = text;
    };
    apply();
    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(apply);
      mo.observe(native, { childList: true, characterData: true, subtree: true });
      // パネルを閉じるときに切断する（閉じた後のアイコンは誰も見ていない）
      if (panelObservers) panelObservers.push(mo);
    }
  }

  /* ---------------- スマゲータウンから開いたゲーム ---------------- */

  /* タウンが移る直前に書いた控え。このゲームのもので新しければ {d, body} を返す */
  function townReturn() {
    var raw;
    try { raw = window.localStorage.getItem(LS_TOWN_RETURN); } catch (e) { return null; }
    var rec = parseJson(raw);
    if (!rec || typeof rec !== 'object' || rec.v !== 1 || rec.d !== GAME) return null;
    var t = (typeof rec.t === 'number' && isFinite(rec.t)) ? rec.t : 0;
    if (!t || Math.floor(Date.now() / 1000) - t > TOWN_RETURN_SEC) return null;
    var body = (rec.body && typeof rec.body === 'object' && !Array.isArray(rec.body)) ? rec.body : null;
    if (!body || typeof body.uid !== 'string' || typeof body.key !== 'string') return null;
    return { d: rec.d, body: body };
  }

  /* ゲームプレイ中の在室（タウンの受け口へ、控えの body をそのまま送る。応答は使わない） */
  function townHeartbeat(rec) {
    var text;
    try { text = JSON.stringify(rec.body); } catch (e) { return; }
    var send = function () {
      if (typeof window.fetch !== 'function') return;
      try {
        window.fetch(TOWN_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, cache: 'no-store', keepalive: true }).catch(function () {});
      } catch (e) { /* 送れなくても何もしない（タウン側で 3 分後に消える） */ }
    };
    send();
    var timer = window.setInterval(send, TOWN_HB_MS);
    // 裏に回っていた（心拍が止まっていた）タブが戻ったらすぐ送る
    document.addEventListener('visibilitychange', function () { if (!document.hidden) send(); });
    window.addEventListener('pagehide', function () { window.clearInterval(timer); });
  }

  /* ---------------- ヘッダー本体 ---------------- */

  function buildHeader() {
    // ゲーム側にも <header>（banner）があるので、サイト共通のバーはナビゲーションとして置く（banner の重複を避ける）
    var header = el('div', 'sgh-header');
    header.id = 'sgh-header';
    header.setAttribute('role', 'navigation');
    header.setAttribute('aria-label', 'スマートゲームのメニュー');
    isolatePointer(header, false);

    var fromTown = townReturn();
    var logo;
    if (fromTown) {
      // スマゲータウンから開いたゲーム: 左上はタウンへ戻るリンク（筐体の前から再開する）
      logo = el('a', 'sgh-header__logo sgh-header__logo--town');
      logo.id = 'sgh-logo-btn';
      logo.href = TOWN_URL;
      logo.setAttribute('aria-label', 'スマゲータウンに戻る');
      var townMark = el('span', 'sgh-header__mark');
      townMark.setAttribute('aria-hidden', 'true');
      logo.appendChild(townMark);
      logo.appendChild(el('span', 'sgh-header__title', 'スマゲータウンに戻る'));
      townHeartbeat(fromTown);
    } else {
      logo = el('button', 'sgh-header__logo');
      logo.type = 'button';
      logo.id = 'sgh-logo-btn';
      logo.setAttribute('aria-expanded', 'false');
      logo.setAttribute('aria-controls', 'sgh-site-panel');
      logo.setAttribute('aria-label', 'スマートゲームのメニューを開く');
      var mark = el('span', 'sgh-header__mark');
      mark.setAttribute('aria-hidden', 'true');
      logo.appendChild(mark);
      logo.appendChild(el('span', 'sgh-header__title', 'スマートゲーム'));
      var caret = el('span', 'sgh-header__caret');
      caret.setAttribute('aria-hidden', 'true');
      logo.appendChild(caret);
      logo.addEventListener('click', function () {
        showPanel('left', logo, buildSitePanel);
      });
    }

    var burger = el('button', 'sgh-header__burger');
    burger.type = 'button';
    burger.id = 'sgh-menu-btn';
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'sgh-game-panel');
    burger.setAttribute('aria-label', 'このゲームのメニューを開く');
    var bars = el('span', 'sgh-burger');
    bars.setAttribute('aria-hidden', 'true');
    bars.appendChild(el('i'));
    bars.appendChild(el('i'));
    bars.appendChild(el('i'));
    burger.appendChild(bars);
    burger.addEventListener('click', function () {
      showPanel('right', burger, buildGamePanel);
    });

    header.appendChild(logo);
    header.appendChild(burger);
    document.body.insertBefore(header, document.body.firstChild);
  }

  /* 共通ヘッダーに集約した元ボタンを隠す。空になった入れ物も一緒に隠す */
  function hideNatives() {
    var touched = [];
    for (var i = 0; i < MENU.length; i++) {
      var item = MENU[i];
      if (!item || !item.hide || typeof item.sel !== 'string') continue;
      var native = document.querySelector(item.sel);
      if (!native) continue;
      native.classList.add('sgh-native-hidden');
      if (native.parentNode && touched.indexOf(native.parentNode) === -1) touched.push(native.parentNode);
    }
    for (var j = 0; j < touched.length; j++) {
      var parent = touched[j];
      var kids = parent.children;
      var visible = 0;
      for (var k = 0; k < kids.length; k++) {
        if (!kids[k].classList.contains('sgh-native-hidden')) visible++;
      }
      if (!visible) parent.classList.add('sgh-native-hidden');
    }
  }

  rememberVisit();
  hideNatives();
  buildHeader();
})();
