/*
 * スマートゲーム アカウント（サイト全体で共通のログイン）のクライアント
 *
 * どのページからも同じように使う小さなライブラリ。読み込むと window.SGAccount ができる。
 *   SGAccount.me()            → Promise<user|null>  サーバー（/account/api.php?a=me）に問い合わせる（1 ページ 1 回。force で取り直す）
 *   SGAccount.hint()          → {id, name} | null   前回ログインしていた控え（localStorage）。通信せずにすぐ出す用
 *   SGAccount.onChange(fn)    → ログイン状態が分かった／変わったときに fn(user) を呼ぶ（登録時に既に分かっていれば即呼ぶ）
 *   SGAccount.post(action, data) → Promise<応答>   api.php の各操作（失敗は {error} で reject）
 *   SGAccount.logout(all)     → Promise
 *   SGAccount.url(back)       → アカウントページの URL（back は戻り先のパス）
 *   SGAccount.providers()     → 使えるソーシャルログイン {google: 'Google', …}（me() のあと）
 *   SGAccount.wallet()        → {gems, bonus} | null  スマジェム（有償）・ボーナスジェムの残高（me() / fetchWallet() の応答から。ゲストは null）
 *   SGAccount.onWallet(fn)    → 残高が分かった／変わったときに fn(wallet) を呼ぶ
 *   SGAccount.fetchWallet()   → Promise<{wallet, packs, methods, enabled, max, ledger, orders}>  /account/api.php?a=wallet（ログイン中だけ）
 *   SGAccount.checkout(pack, back) → Promise<{url, order}>  スマジェムの購入（Stripe Checkout へ。url に移動する）
 *   SGAccount.order(id)       → Promise<{order, wallet}>  注文の状態
 *   SGAccount.spendGems(gems, key, memo) → Promise<{wallet, spent, dup}>  ジェムを使う（key は冪等キー。SGAccount.spendKey() で作る）
 *   SGAccount.gemsUrl(back)   → スマジェムの購入ページ（/account/gems/）の URL
 *   SGAccount.gifts()         → [{key, coins, memo, item?, n?}]  受け取り待ちのプレゼント（登録記念のスマコイン・管理画面から配布されたタウンのアイテム（item と個数 n）。me() / fetchWallet() / claimGift() の応答から。ゲストは []）
 *   SGAccount.claimGift(key)  → Promise<{coins, memo, dup, item?, n?, wallet, gifts}>  プレゼントを受け取る（スマゲータウンが呼び、受理されたら端末のスマコイン・持ち物に足す。受け取り済みなら dup）
 *
 * user は {id, name, email, email_verified, has_password, providers: [{p, label, at}], created} か null（ゲスト）。
 * ログイン状態そのものは HttpOnly の Cookie（sg_session）にあり、JS からは触れない。
 * localStorage の控え（smartgame:account）は表示を速くするためだけのもので、正はいつもサーバー。
 * ランキング名（smartgame_ranking_name）が未設定の端末では、ログインしたアカウントの表示名を入れる。
 */
(function () {
  'use strict';

  var API = '/account/api.php';
  var PAGE = '/account/';
  var GEMS_PAGE = '/account/gems/';
  var LS_HINT = 'smartgame:account';
  var LS_RANK_NAME = 'smartgame_ranking_name';
  var NAME_MAX = 10;

  var user = null;
  var known = false;      // me() の応答を一度でも受け取ったか
  var providers = {};
  var wallet = null;      // {gems, bonus}（ログイン中だけ）
  var gifts = [];         // 受け取り待ちのスマコインのプレゼント [{key, coins, memo}]（ログイン中だけ）
  var walletListeners = [];
  var pending = null;
  var listeners = [];

  function readHint() {
    var raw;
    try { raw = window.localStorage.getItem(LS_HINT); } catch (e) { return null; }
    if (!raw) return null;
    var v;
    try { v = JSON.parse(raw); } catch (e) { return null; }
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
    if (!/^[0-9a-f]{12}$/.test(v.id)) return null;
    return { id: v.id, name: v.name.slice(0, NAME_MAX) };
  }

  function writeHint(u) {
    try {
      if (u) window.localStorage.setItem(LS_HINT, JSON.stringify({ id: u.id, name: u.name, t: Math.floor(Date.now() / 1000) }));
      else window.localStorage.removeItem(LS_HINT);
    } catch (e) { /* 保存できなくても動く */ }
  }

  /* サーバーの応答の user を検証してから使う */
  function cleanUser(u) {
    if (!u || typeof u !== 'object') return null;
    if (typeof u.id !== 'string' || !/^[0-9a-f]{12}$/.test(u.id)) return null;
    var provs = [];
    if (Array.isArray(u.providers)) {
      for (var i = 0; i < u.providers.length; i++) {
        var p = u.providers[i];
        if (p && typeof p.p === 'string' && /^[a-z]{1,16}$/.test(p.p)) provs.push({ p: p.p, label: typeof p.label === 'string' ? p.label : '', at: typeof p.at === 'number' ? p.at : 0 });
      }
    }
    return {
      id: u.id,
      name: typeof u.name === 'string' ? u.name.slice(0, NAME_MAX) : '',
      email: typeof u.email === 'string' ? u.email : '',
      email_verified: !!u.email_verified,
      has_password: !!u.has_password,
      providers: provs,
      created: typeof u.created === 'number' ? u.created : 0
    };
  }

  /* サーバーの応答の wallet を検証してから使う（整数・0 以上）。ゲストは null */
  function cleanWallet(w) {
    if (!w || typeof w !== 'object') return null;
    var g = w.gems, b = w.bonus;
    if (typeof g !== 'number' || typeof b !== 'number' || !isFinite(g) || !isFinite(b)) return null;
    g = Math.max(0, Math.floor(g)); b = Math.max(0, Math.floor(b));
    return { gems: g, bonus: b };
  }

  /* サーバーの応答の gifts を検証してから使う（key は英小文字はじまり。スマコイン（coins 1 以上）か タウンのアイテム（item の id と個数 n 1〜99）のどちらか） */
  function cleanGifts(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < 8; i++) {
      var g = list[i];
      if (!g || typeof g !== 'object' || typeof g.key !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(g.key)) continue;
      var memo = typeof g.memo === 'string' ? g.memo.slice(0, 120) : '';
      if (typeof g.item === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(g.item)) {
        var n = typeof g.n === 'number' && isFinite(g.n) ? Math.floor(g.n) : 1;
        if (n < 1 || n > 99) continue;
        out.push({ key: g.key, coins: 0, item: g.item, n: n, memo: memo });
        continue;
      }
      if (typeof g.coins !== 'number' || !isFinite(g.coins) || g.coins < 1) continue;
      out.push({ key: g.key, coins: Math.floor(g.coins), memo: memo });
    }
    return out;
  }

  function setWallet(w) {
    var before = wallet ? wallet.gems + '/' + wallet.bonus : '';
    wallet = w;
    var after = w ? w.gems + '/' + w.bonus : '';
    for (var i = 0; i < walletListeners.length; i++) {
      try { walletListeners[i](w, before !== after); } catch (e) { /* ignore */ }
    }
  }

  function apply(u) {
    var before = user ? user.id + '/' + user.name : '';
    user = u;
    known = true;
    writeHint(u);
    if (u && u.name) {
      // ランキング名が未設定の端末なら、アカウントの表示名をそのまま使う
      try { if (!window.localStorage.getItem(LS_RANK_NAME)) window.localStorage.setItem(LS_RANK_NAME, u.name); } catch (e) { /* ignore */ }
    }
    var after = u ? u.id + '/' + u.name : '';
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](u, before !== after); } catch (e) { /* 1 つの購読者の失敗でほかを止めない */ }
    }
  }

  function request(method, body, getAction) {
    if (typeof window.fetch !== 'function') return Promise.reject({ error: 'unsupported' });
    var opts = { method: method, credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return window.fetch(method === 'GET' ? API + '?a=' + (getAction || 'me') : API, opts).then(function (res) {
      return res.json().catch(function () { return { ok: false, error: res.ok ? 'bad_response' : 'http_' + res.status }; });
    }, function () {
      return { ok: false, error: 'network' };
    }).then(function (json) {
      if (!json || typeof json !== 'object') throw { error: 'bad_response' };
      if (!json.ok) throw { error: typeof json.error === 'string' ? json.error : 'server_error' };
      return json;
    });
  }

  function me(force) {
    if (known && !force && !pending) return Promise.resolve(user);
    if (pending) return pending;
    pending = request('GET').then(function (json) {
      pending = null;
      if (json.providers && typeof json.providers === 'object') providers = json.providers;
      var u = cleanUser(json.user);
      gifts = u ? cleanGifts(json.gifts) : [];   // apply() の購読者（タウン）が gifts() を見るので先に
      apply(u);
      setWallet(user ? cleanWallet(json.wallet) : null);
      return user;
    }, function (err) {
      pending = null;
      // 通信できなかったときは分からないまま（控えも消さない）
      throw err;
    });
    return pending;
  }

  function post(action, data) {
    var body = data && typeof data === 'object' ? data : {};
    body.a = action;
    return request('POST', body).then(function (json) {
      if (Object.prototype.hasOwnProperty.call(json, 'gifts')) gifts = cleanGifts(json.gifts);
      else if (Object.prototype.hasOwnProperty.call(json, 'user') && !json.user) gifts = [];   // ログアウト・削除
      if (Object.prototype.hasOwnProperty.call(json, 'user')) apply(cleanUser(json.user));
      if (Object.prototype.hasOwnProperty.call(json, 'wallet')) setWallet(cleanWallet(json.wallet));
      else if (Object.prototype.hasOwnProperty.call(json, 'user') && !json.user) setWallet(null);   // ログアウト・削除
      return json;
    });
  }

  /* ---- スマジェム ---- */

  function fetchWallet() {
    return request('GET', null, 'wallet').then(function (json) {
      gifts = cleanGifts(json.gifts);
      if (Object.prototype.hasOwnProperty.call(json, 'user')) apply(cleanUser(json.user));
      setWallet(cleanWallet(json.wallet));
      return json;
    }, function (err) {
      if (err && err.error === 'not_logged_in') { gifts = []; if (user) apply(null); setWallet(null); }
      throw err;
    });
  }

  function onWallet(fn) {
    if (typeof fn !== 'function') return;
    walletListeners.push(fn);
    if (known) { try { fn(wallet, false); } catch (e) { /* ignore */ } }
  }

  /* 使うときの冪等キー（同じキーの spend はサーバーが 2 度適用しない） */
  function spendKey() {
    var hex = '';
    try {
      var a = new Uint8Array(12);
      window.crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) hex += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    } catch (e) {
      for (var j = 0; j < 24; j++) hex += Math.floor(Math.random() * 16).toString(16);
    }
    return 'x' + hex;
  }

  function gemsUrl(back) {
    var b = typeof back === 'string' && /^\/(?!\/)[\w\-./?=&#%~+]*$/.test(back) ? back : '';
    return GEMS_PAGE + (b ? '?back=' + encodeURIComponent(b) : '');
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
    if (known) { try { fn(user, false); } catch (e) { /* ignore */ } }
  }

  function url(back) {
    var b = typeof back === 'string' && /^\/(?!\/)[\w\-./?=&#%~+]*$/.test(back) ? back : '';
    return PAGE + (b ? '?back=' + encodeURIComponent(b) : '');
  }

  window.SGAccount = {
    me: me,
    hint: readHint,
    user: function () { return user; },
    known: function () { return known; },
    providers: function () { return providers; },
    onChange: onChange,
    post: post,
    logout: function (all) { return post('logout', { all: !!all }); },
    url: url,
    // スマジェム（有償）・ボーナスジェム
    wallet: function () { return wallet; },
    onWallet: onWallet,
    fetchWallet: fetchWallet,
    checkout: function (pack, back) { return post('checkout', { pack: String(pack || ''), back: typeof back === 'string' ? back : '' }); },
    order: function (id) { return post('order', { id: String(id || '') }); },
    spendGems: function (gems, key, memo) { return post('spend', { gems: Math.floor(Number(gems) || 0), key: String(key || ''), memo: typeof memo === 'string' ? memo : '' }); },
    spendKey: spendKey,
    gemsUrl: gemsUrl,
    // スマコインのプレゼント（登録記念 等）。受け取るのはスマゲータウン
    gifts: function () { return gifts.slice(); },
    claimGift: function (key) { return post('claim', { key: String(key || '') }); },
    GEMS_PAGE: GEMS_PAGE,
    NAME_MAX: NAME_MAX
  };
})();
