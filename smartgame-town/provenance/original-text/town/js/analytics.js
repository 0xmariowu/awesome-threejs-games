'use strict';
/* Google tag (gtag.js) の初期化。
   CSP の script-src からインライン<script>を排除するため外部ファイル化している。
   gtag.js 本体（async読み込み）とどちらが先に実行されても動作する */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());

gtag('config', 'G-EY2KEWHS64');
