/* Google Analytics (gtag.js) 初期化
   本体スニペットは index.html で async 読み込み。
   CSPで unsafe-inline を許可しないため、初期化コードを外部ファイル化している。 */
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', 'G-EY2KEWHS64');
