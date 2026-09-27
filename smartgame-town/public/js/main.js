/* スマートゲーム トップページ演出
   - 星空パーティクル背景（canvas）
   - タイピング演出
   - システム時計
   - スクロールリビール
   - 人気ゲームのアイコン描画（データは js/games.js）
   - ゲーム一覧の表示切り替え（カード / アイコン）
   - ゲームカードの3Dチルト
   すべて prefers-reduced-motion を尊重する */
(function () {
  'use strict';

  document.documentElement.classList.add('js-on');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ヘッダーのアカウント（/account/。ログイン中はニックネーム） ---------- */
  (function () {
    var link = document.getElementById('hdr-account');
    var text = document.getElementById('hdr-account-text');
    var acct = window.SGAccount;
    if (!link || !text || !acct) return;
    var paint = function (u) {
      text.textContent = u ? (u.name || 'アカウント') : 'ログイン';
      link.classList.toggle('is-on', !!u);
      link.setAttribute('aria-label', u ? 'アカウント設定（' + (u.name || 'ログイン中') + '）' : 'アカウント（ログイン／新規登録）');
    };
    paint(acct.hint());
    acct.onChange(paint);
    acct.me().catch(function () { /* 通信できなければ控えのまま */ });
  })();

  /* ---------- 星空パーティクル ---------- */
  var canvas = document.getElementById('bg-stars');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var stars = [];
    var W = 0, H = 0;
    var COLORS = ['#9be8ff', '#b39dff', '#ffffff', '#ff9ac6'];

    function resize() {
      // スマホは描画解像度を抑えてスクロール中のGPU負荷を下げる
      var maxDpr = window.innerWidth < 768 ? 1.5 : 2;
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeStars() {
      var density = window.innerWidth < 768 ? 14000 : 9000;
      var count = Math.min(140, Math.floor(W * H / density));
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.4 + 0.4,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          vy: Math.random() * 0.16 + 0.03,
          tw: Math.random() * Math.PI * 2,
          ts: Math.random() * 0.03 + 0.008
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.tw += s.ts;
        var a = 0.35 + Math.abs(Math.sin(s.tw)) * 0.65;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        s.y -= s.vy;
        if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
      }
      ctx.globalAlpha = 1;
    }

    var rafId = null;
    function loop() {
      draw();
      rafId = requestAnimationFrame(loop);
    }

    resize();
    makeStars();
    if (reduceMotion) {
      draw(); // 静止画として1回だけ描画
    } else {
      loop();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        } else if (!rafId) {
          loop();
        }
      });
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resize(); makeStars(); if (reduceMotion) draw(); }, 200);
    });
  }

  /* ---------- タイピング演出 ---------- */
  var typeTarget = document.getElementById('type-target');
  if (typeTarget) {
    var text = 'INITIALIZING SMARTGAME.JP ... READY';
    if (reduceMotion) {
      typeTarget.textContent = text;
    } else {
      var idx = 0;
      (function typeNext() {
        if (idx <= text.length) {
          typeTarget.textContent = text.slice(0, idx);
          idx++;
          setTimeout(typeNext, idx < 14 ? 45 : 28);
        }
      })();
    }
  }

  /* ---------- ロゴの日英スイッチ（グリッチ中に差し替え） ---------- */
  // 読み上げ・検索エンジン向けの名前はカタカナロゴの alt（スマートゲーム）で固定。英字ロゴは aria-hidden
  var heroLogo = document.getElementById('hero-logo');
  if (heroLogo && !reduceMotion) {
    var logos = heroLogo.querySelectorAll('.hero-logo-img');
    var lIdx = 0;
    var swapLogo = function () {
      if (document.hidden) return; // 裏に回っている間は動かさない
      heroLogo.classList.add('glitching');
      setTimeout(function () {
        logos[lIdx].classList.remove('is-on');
        lIdx = (lIdx + 1) % logos.length;
        logos[lIdx].classList.add('is-on');
      }, 260); // グリッチの最中に差し替える
      setTimeout(function () {
        heroLogo.classList.remove('glitching');
      }, 580);
    };
    if (logos.length > 1) {
      setTimeout(function () {
        swapLogo();
        setInterval(swapLogo, 3800);
      }, 2200);
    }
  }

  /* ---------- システム時計 ---------- */
  var clock = document.getElementById('sys-clock');
  if (clock) {
    var tick = function () {
      var d = new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- スクロールリビール ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- 人気ゲーム（games.js のカタログをアイコン形式で描画） ----------
     表示順は Google Analytics の直近7日ページビューを集計するランキングAPI
     （Cloud Run・games.js の SMARTGAME_POPULAR_API）から取得する。
     API応答を待ってから一度だけ描画する（先にフォールバック順を見せると
     応答後に一覧が差し替わって見えるため）。API障害・タイムアウト・
     集計データ不足時のみフォールバック順で描画する。
     32位まで1列に並べ、横スクロールで見る（レイアウトは style.css の .popular-grid） */
  var POPULAR_MAX = 32; // 人気ゲームは32位まで表示（API側の MAX_RANKING_SIZE と揃える）
  var popularSection = document.getElementById('popular');
  var popularGrid = document.getElementById('popular-grid');
  var GAME_CATALOG = window.SMARTGAME_GAMES || {};

  var renderPopular = function (dirs) {
    // カタログにあるゲームだけを描画対象にする（APIから未知の値が来ても無視）
    var games = dirs.map(function (dir) {
      var g = Object.prototype.hasOwnProperty.call(GAME_CATALOG, dir) ? GAME_CATALOG[dir] : null;
      return g ? { url: '/' + dir + '/', name: g.name, icon: g.icon } : null;
    }).filter(Boolean).slice(0, POPULAR_MAX);
    if (!games.length) {
      // 描画できるゲームが1件も無い場合はスケルトンを片付けてセクションごと隠す
      popularGrid.textContent = '';
      popularSection.hidden = true;
      return;
    }

    popularGrid.textContent = '';
    popularGrid.removeAttribute('aria-busy');
    games.forEach(function (game, i) {
      var rankNo = i + 1;

      var li = document.createElement('li');
      li.className = 'popular-item';

      var a = document.createElement('a');
      a.className = 'popular-link';
      a.href = game.url;

      var rank = document.createElement('span');
      rank.className = 'popular-rank popular-rank-' + rankNo;
      rank.textContent = rankNo;
      rank.setAttribute('aria-label', rankNo + '位');

      var img = document.createElement('img');
      img.className = 'game-icon';
      img.src = game.icon;
      img.alt = '';
      img.width = 192;
      img.height = 192;
      img.loading = 'lazy';
      img.decoding = 'async';

      var name = document.createElement('span');
      name.className = 'popular-name';
      name.textContent = game.name;

      a.appendChild(rank);
      a.appendChild(img);
      a.appendChild(name);
      li.appendChild(a);
      popularGrid.appendChild(li);
    });
    popularSection.hidden = false;
  };

  if (popularSection && popularGrid) {
    // API応答を待つ間はスケルトン（シマー）を先に描画してセクションを表示しておく。
    // 応答後にセクションごと出現してページ全体がズレるのを防ぐため
    popularGrid.setAttribute('aria-busy', 'true');
    for (var skI = 0; skI < POPULAR_MAX; skI++) {
      var skLi = document.createElement('li');
      skLi.className = 'popular-item is-skeleton';
      skLi.setAttribute('aria-hidden', 'true');

      var skIcon = document.createElement('span');
      skIcon.className = 'popular-skel-icon popular-shimmer';

      var skName = document.createElement('span');
      skName.className = 'popular-skel-name popular-shimmer';

      skLi.appendChild(skIcon);
      skLi.appendChild(skName);
      popularGrid.appendChild(skLi);
    }
    popularSection.hidden = false;

    // 一度描画したら以後の応答は無視する（タイムアウト後に遅れて届いた
    // API応答で一覧が差し替わるのを防ぐ）
    var popularDone = false;
    var settlePopular = function (dirs) {
      if (popularDone) return;
      popularDone = true;
      renderPopular((dirs && dirs.length) ? dirs : (window.SMARTGAME_POPULAR_FALLBACK || []));
    };

    var apiUrl = window.SMARTGAME_POPULAR_API;
    if (apiUrl && window.fetch) {
      // API応答が遅い場合はフォールバック順で描画する
      var popularTimer = setTimeout(function () { settlePopular(null); }, 4000);
      fetch(apiUrl).then(function (res) {
        if (!res.ok) throw new Error('popular api: ' + res.status);
        return res.json();
      }).then(function (data) {
        clearTimeout(popularTimer);
        // 応答形式: { ranking: [{ dir: 'solitaire', views: 123 }, ...] }（views降順）
        var ranking = data && data.ranking;
        var dirs = Array.isArray(ranking) ? ranking.map(function (row) {
          return (row && typeof row.dir === 'string') ? row.dir : null;
        }).filter(function (dir) {
          return dir && Object.prototype.hasOwnProperty.call(GAME_CATALOG, dir);
        }) : [];
        // 集計データが少なすぎる場合（GA導入直後など）はフォールバック順で描画
        settlePopular(dirs.length >= 3 ? dirs : null);
      }).catch(function () {
        clearTimeout(popularTimer);
        settlePopular(null);
      });
    } else {
      settlePopular(null);
    }
  }

  /* ---------- ゲーム一覧の表示切り替え（カード / アイコン）＋タグ絞り込み＋もっと見る ---------- */
  var gameGrid = document.getElementById('game-grid');
  var viewBtns = document.querySelectorAll('.view-btn');
  var moreWrap = document.getElementById('more-wrap');
  var moreBtn = document.getElementById('btn-more');
  var filterWrap = document.getElementById('tag-filter');
  var filterBtns = filterWrap ? Array.prototype.slice.call(filterWrap.querySelectorAll('.filter-btn')) : [];
  if (gameGrid && viewBtns.length) {
    var VIEW_KEY = 'smartgame-view';
    // 表示上限: カード表示は12件（PCの2〜4列いずれでも割り切れる数）、アイコン表示は40件。超過分は「もっと見る」で追加表示
    var PAGE_SIZE = { cards: 12, icons: 40 };

    // ゲーム一覧の並びは毎回ランダムにする（Fisher-Yates シャッフル）。
    // 「準備中」プレースホルダーは末尾に固定し、シャッフル後に装飾番号（.thumb-no）を振り直す。
    (function shuffleGameGrid() {
      var all = Array.prototype.slice.call(gameGrid.children);
      var playable = all.filter(function (c) { return !c.classList.contains('game-card-soon'); });
      var soon = all.filter(function (c) { return c.classList.contains('game-card-soon'); });
      for (var i = playable.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = playable[i];
        playable[i] = playable[j];
        playable[j] = tmp;
      }
      var ordered = playable.concat(soon);
      var frag = document.createDocumentFragment();
      ordered.forEach(function (card, idx) {
        var no = card.querySelector('.thumb-no');
        if (no) no.textContent = ('0' + (idx + 1)).slice(-2);
        frag.appendChild(card);
      });
      gameGrid.appendChild(frag);
    })();

    var gameCards = Array.prototype.slice.call(gameGrid.children);
    var currentView = 'cards';
    var visibleCount = { cards: PAGE_SIZE.cards, icons: PAGE_SIZE.icons };
    // タグ絞り込み（カード・アイコン両表示で有効）。空文字は「すべて」
    var activeFilter = '';

    // 総ゲーム数の表示（「準備中」プレースホルダーは除外して数える）
    var countEl = document.getElementById('game-count');
    var playableCards = gameCards.filter(function (c) { return !c.classList.contains('game-card-soon'); });
    var totalGames = playableCards.length;

    // カードが現在の絞り込みに合致するか。各カードの data-tags（半角スペース区切り）と照合する
    var cardMatchesFilter = function (card) {
      if (!activeFilter) return true;
      var tags = (card.getAttribute('data-tags') || '').split(/\s+/);
      return tags.indexOf(activeFilter) !== -1;
    };

    // ゲーム数表示を更新。絞り込みなしは総数、絞り込み中は「全N中 M件」。数値は textContent で挿入する
    var updateCount = function () {
      if (!countEl) return;
      countEl.textContent = '';
      var num = document.createElement('span');
      num.className = 'count-num';
      if (!activeFilter) {
        num.textContent = totalGames;
        countEl.appendChild(document.createTextNode('全'));
        countEl.appendChild(num);
        countEl.appendChild(document.createTextNode('ゲーム'));
      } else {
        num.textContent = playableCards.filter(cardMatchesFilter).length;
        countEl.appendChild(document.createTextNode('全' + totalGames + 'ゲーム中 '));
        countEl.appendChild(num);
        countEl.appendChild(document.createTextNode('件'));
      }
    };

    // アイコン表示用の短縮タイトル。「日本語 - English」形式の英語サブタイトルだけを除去する。
    // ハイフン以降がラテン文字（英数記号・空白）のみのときだけ削除し、
    // 「Box4 - 重力四目並べ」「マルバツゲーム - ○×ゲーム」など後半が日本語のものはそのまま残す。
    var iconLabel = function (full) {
      var m = full.match(/^(.+?)\s+-\s+([\s\S]+)$/);
      if (m && /^[\x20-\x7E]+$/.test(m[2])) return m[1];
      return full;
    };
    // 各カードの見出しに、フル表記とアイコン用短縮表記を保持しておく（表示切り替えで付け替える）
    var gameNames = gameCards.map(function (card) { return card.querySelector('.game-name'); });
    gameNames.forEach(function (el) {
      if (el) {
        el.dataset.fullName = el.textContent;
        el.dataset.iconName = iconLabel(el.textContent);
      }
    });

    var applyVisibility = function () {
      var limit = visibleCount[currentView];
      var matched = 0;
      gameCards.forEach(function (card) {
        var m = cardMatchesFilter(card);
        card.classList.toggle('is-more-hidden', !m || matched >= limit);
        if (m) matched++;
      });
      if (moreWrap) moreWrap.hidden = matched <= limit;
      updateCount();
    };

    var setView = function (view) {
      currentView = view;
      var isIcons = view === 'icons';
      gameGrid.classList.toggle('is-icons', isIcons);
      // アイコン表示では英語サブタイトルを外した短縮タイトル、カード表示ではフル表記に戻す
      gameNames.forEach(function (el) {
        if (el) el.textContent = isIcons ? el.dataset.iconName : el.dataset.fullName;
      });
      viewBtns.forEach(function (btn) {
        var active = btn.getAttribute('data-view') === view;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      // タグ絞り込みはカード・アイコン両表示で出す
      if (filterWrap) filterWrap.hidden = false;
      applyVisibility();
      try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* プライベートモード等では記憶しない */ }
    };
    viewBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view'));
      });
    });

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-filter') || '';
        // 絞り込み変更時は両表示の表示件数をリセット
        visibleCount.cards = PAGE_SIZE.cards;
        visibleCount.icons = PAGE_SIZE.icons;
        filterBtns.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyVisibility();
      });
    });

    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        visibleCount[currentView] += PAGE_SIZE[currentView];
        applyVisibility();
      });
    }

    var savedView = null;
    try { savedView = localStorage.getItem(VIEW_KEY); } catch (e) { /* noop */ }
    setView(savedView === 'icons' ? 'icons' : 'cards');
  }

  /* ---------- カード3Dチルト ---------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      var rect = null;
      card.addEventListener('pointerenter', function () {
        rect = card.getBoundingClientRect();
      });
      card.addEventListener('pointermove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = 'perspective(800px) rotateY(' + (px * 7) + 'deg) rotateX(' + (-py * 7) + 'deg) translateY(-2px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
        rect = null;
      });
    });
  }
})();
