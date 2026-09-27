// Station interior textures — ONLY genuine flat graphics for the modelled interior: individual notice
// sheets (pinned one by one on the cork boards), machine labels, LED / monitor screens, the chalk
// 伝言板 surface, binder spine labels, newspaper / pamphlet covers, plus the soft light-pool gradient
// and a cork tile. Nothing here stands in for geometry.
import { makeAtlas } from './util.js';
import { INK } from './tex.js';

export function createInteriorTextures(ctx, tx) {
  const T = ctx.tex, F = T.FONTS, txt = tx.txt, blossom = tx.blossom;
  const rr = (g, x, y, w, h, r) => T.roundRect(g, x, y, w, h, r);
  const paper = (g, w, h, c = '#f3f1ea') => { g.fillStyle = c; g.fillRect(0, 0, w, h); };
  const lines = (g, arr, x, y0, gap, o = {}) => arr.forEach((s, i) => txt(g, s, x, y0 + i * gap, o.size || 11, o.color || INK.ink, { weight: o.weight || 500, align: o.align, maxW: o.maxW, font: o.font }));

  // ---------------------------------------------------------------- notice sheets (A4-ish, 120 × 170)
  const notice = (id, draw) => ({ id, w: 120, h: 170, draw });
  const sheets = [
    notice('nDaiya', (g, w, h) => {
      paper(g, w, h); g.fillStyle = INK.navy; g.fillRect(0, 0, w, 30); txt(g, 'お知らせ', w / 2, 16, 15, '#fff', { weight: 700 });
      txt(g, 'ダイヤ改正', w / 2, 52, 19, INK.navy, { weight: 900 });
      lines(g, ['3月14日(土)始発より', '一部列車の発車時刻が', '変わります。', '新しい時刻表は', '改札口にございます。'], w / 2, 80, 15, { size: 10 });
      g.fillStyle = INK.pink; g.fillRect(10, h - 22, w - 20, 3); txt(g, '桜川電鉄 桜ヶ丘駅', w / 2, h - 11, 9, INK.grey);
    }),
    notice('nCat', (g, w, h) => {
      paper(g, w, h, '#fdf2cc'); txt(g, '迷い猫', w / 2, 20, 24, INK.red, { weight: 900 }); txt(g, 'さがしています', w / 2, 42, 11, INK.ink, { weight: 700 });
      g.fillStyle = '#f2f0ea'; g.beginPath(); g.arc(60, 84, 26, 0, 7); g.fill();
      g.fillStyle = '#e59a4a'; g.beginPath(); g.arc(50, 76, 13, 0, 7); g.fill(); g.fillStyle = '#4a4046'; g.beginPath(); g.arc(72, 90, 10, 0, 7); g.fill();
      g.fillStyle = '#f2f0ea'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(60 + s * 24, 70); g.lineTo(60 + s * 18, 50); g.lineTo(60 + s * 8, 62); g.fill(); }
      g.fillStyle = INK.ink; g.fillRect(49, 82, 4, 4); g.fillRect(67, 82, 4, 4);
      lines(g, ['三毛猫・メス「みけ」', '赤い首輪をしています', '見かけた方は駅員まで'], w / 2, 126, 14, { size: 9.5, weight: 700 });
    }),
    notice('nClean', (g, w, h) => {
      paper(g, w, h, '#e6f1e4'); g.fillStyle = INK.green; g.fillRect(0, 0, w, 34); txt(g, '清掃', w / 2, 12, 12, '#fff', { weight: 700 }); txt(g, 'ボランティア', w / 2, 26, 12, '#fff', { weight: 700 });
      txt(g, '桜川堤の', w / 2, 54, 14, INK.ink, { weight: 700 }); txt(g, 'ごみ拾い', w / 2, 72, 17, INK.green, { weight: 900 });
      lines(g, ['4月12日(日)', '午前9:00〜11:00', '集合：駅前広場', '軍手・袋を配ります'], w / 2, 96, 15, { size: 10 });
      txt(g, '桜ヶ丘町内会', w / 2, h - 10, 9, INK.grey);
    }),
    notice('nRec', (g, w, h) => {
      paper(g, w, h, '#fbe9ef'); txt(g, '駅長おすすめ', w / 2, 18, 15, '#c2456e', { weight: 900, font: F.round });
      blossom(g, 36, 56, 16); blossom(g, 84, 48, 12); blossom(g, 66, 74, 10);
      lines(g, ['桜川堤の桜が', '見ごろです！', '北口から徒歩12分'], w / 2, 104, 16, { size: 12, weight: 700 });
      txt(g, '— 桜ヶ丘駅 駅長', w / 2 + 10, h - 12, 9, INK.grey, { font: F.hand });
    }),
    notice('nLost', (g, w, h) => {
      paper(g, w, h); g.strokeStyle = INK.navy; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
      txt(g, '落とし物の', w / 2, 24, 14, INK.navy, { weight: 900 }); txt(g, 'お知らせ', w / 2, 42, 14, INK.navy, { weight: 900 });
      g.fillStyle = '#9fd0e6'; rr(g, 46, 56, 28, 50, 8); g.fill(); g.fillStyle = '#6aa0bc'; g.fillRect(48, 56, 24, 8);
      lines(g, ['水色の水筒', '4月2日 1番線ホーム', '駅務室で保管中です'], w / 2, 122, 14, { size: 9.5, weight: 700 });
    }),
    notice('nLib', (g, w, h) => {
      paper(g, w, h, '#e8eef7'); txt(g, '桜ヶ丘図書館', w / 2, 18, 13, INK.navy, { weight: 900 });
      g.fillStyle = '#f2d24a'; g.beginPath(); g.arc(60, 58, 20, 0, 7); g.fill(); g.fillStyle = '#c28a1a'; g.fillRect(40, 72, 40, 6);
      txt(g, '春のおはなし会', w / 2, 98, 13, '#c2456e', { weight: 900 });
      lines(g, ['毎週土曜 14:00〜', '対象：3さい〜', '入場無料'], w / 2, 120, 14, { size: 10 });
    }),
    notice('nBus', (g, w, h) => {
      paper(g, w, h); g.fillStyle = INK.blue; g.fillRect(0, 0, w, 26); txt(g, '路線バス 時刻表', w / 2, 14, 11, '#fff', { weight: 700 });
      txt(g, '駅前 → 市民病院', w / 2, 38, 10, INK.ink, { weight: 700 });
      const r = ctx.rng('n-bus');
      for (let i = 0; i < 9; i++) { const y = 52 + i * 12; g.fillStyle = i % 2 ? '#eceae2' : '#f6f4ee'; g.fillRect(8, y - 6, w - 16, 12); txt(g, String(7 + i * 2), 20, y, 9, INK.navy, { weight: 900 }); for (let k = 0; k < 3; k++) txt(g, String(5 + Math.floor(r() * 50)).padStart(2, '0'), 46 + k * 22, y, 9, INK.ink); }
      txt(g, '桜ヶ丘バス', w / 2, h - 10, 9, INK.grey);
    }),
    notice('nNoSmoke', (g, w, h) => {
      paper(g, w, h); txt(g, 'おねがい', w / 2, 20, 16, INK.red, { weight: 900 });
      g.strokeStyle = INK.red; g.lineWidth = 7; g.beginPath(); g.arc(60, 70, 28, 0, 7); g.stroke(); g.fillStyle = '#6d6b74'; g.fillRect(38, 66, 44, 9); g.beginPath(); g.moveTo(40, 50); g.lineTo(80, 90); g.stroke();
      lines(g, ['駅構内は', '全面禁煙です', 'ご協力をお願いします'], w / 2, 118, 15, { size: 10.5, weight: 700 });
    }),
  ];
  // children's drawings (pinned individually), 150 × 104
  const drawing = (id, i) => ({ id, w: 150, h: 104, draw: (g, w, h) => {
    const r = ctx.rng('dr' + i);
    g.fillStyle = ['#fbf6e8', '#f1f6fb', '#fdf0f2', '#f6f7ea', '#fbf3e6', '#eef6f1'][i]; g.fillRect(0, 0, w, h);
    g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = '#8ec4ea'; g.beginPath(); g.moveTo(4, 12); g.lineTo(146, 8); g.stroke();
    if (i % 3 === 0) { g.fillStyle = '#f7f2e4'; g.strokeStyle = '#555'; g.lineWidth = 2; rr(g, 16, 40, 118, 34, 10); g.fill(); g.stroke(); g.fillStyle = '#ef8fb0'; g.fillRect(18, 60, 114, 6); g.fillStyle = '#7fb6e0'; for (let k = 0; k < 4; k++) g.fillRect(26 + k * 26, 46, 16, 10); g.fillStyle = '#555'; g.beginPath(); g.arc(40, 78, 6, 0, 7); g.arc(110, 78, 6, 0, 7); g.fill(); }
    else if (i % 3 === 1) { g.fillStyle = '#8a6040'; g.fillRect(30, 50, 12, 40); g.fillStyle = '#f5aac0'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(24 + r() * 28, 30 + r() * 26, 14, 0, 7); g.fill(); } g.fillStyle = '#f0c080'; g.beginPath(); g.arc(98, 52, 9, 0, 7); g.fill(); g.fillStyle = '#e06080'; g.fillRect(90, 62, 16, 22); g.fillStyle = '#f0c080'; g.beginPath(); g.arc(124, 60, 7, 0, 7); g.fill(); g.fillStyle = '#6ab070'; g.fillRect(118, 68, 12, 16); }
    else { g.fillStyle = '#e8c4a8'; g.fillRect(30, 44, 90, 40); g.fillStyle = '#6a7080'; g.beginPath(); g.moveTo(22, 46); g.lineTo(75, 22); g.lineTo(128, 46); g.fill(); g.fillStyle = '#fff'; g.fillRect(52, 30, 46, 12); g.fillStyle = '#e06080'; g.fillRect(66, 60, 18, 24); g.fillStyle = '#7fb6e0'; g.fillRect(38, 54, 18, 12); g.fillRect(94, 54, 18, 12); }
    g.fillStyle = '#f5c842'; g.beginPath(); g.arc(128, 20, 9, 0, 7); g.fill(); g.fillStyle = '#9ccf7a'; g.fillRect(0, 88, 150, 16);
    txt(g, ['さくら ゆうな', 'はると', 'みお', 'そうた', 'ひなの', 'れん'][i], 112, 95, 10, '#555', { weight: 700, font: F.hand });
  } });
  const drawings = [0, 1, 2, 3, 4, 5].map(i => drawing('dr' + i, i));
  const drawTitle = { id: 'drTitle', w: 300, h: 44, draw: (g, w, h) => { g.fillStyle = '#f4efe0'; g.fillRect(0, 0, w, h); txt(g, 'わたしのすきな さくらがおか', w / 2, 16, 18, '#c2456e', { weight: 700, font: F.hand }); txt(g, '〜 桜ヶ丘小学校 2年生 〜', w / 2, 35, 11, INK.ink); } };

  // ---------------------------------------------------------------- labels for modelled machines & fittings
  const lab = (id, w, h, bg, fg, s, size, o = {}) => ({ id, w, h, draw: (g) => { g.fillStyle = bg; rr(g, 0, 0, w, h, o.r ?? 4); g.fill(); txt(g, s, w / 2, h / 2 + 1, size, fg, { weight: o.weight || 700, maxW: w - 6 }); if (o.sub) txt(g, o.sub, w / 2, h - 7, 8, fg, { weight: 500 }); } });
  const labels = [
    lab('lbCoin', 96, 30, '#e8eef2', INK.ink, '硬貨 Coins', 13),
    lab('lbBill', 96, 30, '#e8eef2', INK.ink, '紙幣 Bills', 13),
    lab('lbTicket', 180, 28, '#e8eef2', INK.ink, 'きっぷ・領収書 取出口', 13),
    lab('lbChange', 180, 28, '#e8eef2', INK.ink, 'おつり・硬貨 取出口', 13),
    lab('lbIC', 64, 30, INK.pink, '#ffffff', 'IC', 20, { weight: 900 }),
    lab('lbCall', 72, 26, '#e8eef2', INK.ink, '係員呼出', 12),
    { id: 'tvmHead', w: 300, h: 60, draw: (g, w, h) => { g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, h); txt(g, 'きっぷ・ICチャージ', 118, 24, 22, '#f4f2ec', { weight: 700 }); txt(g, 'Tickets / IC Charge', 118, 46, 11, '#c9d3e6', { weight: 500 }); g.fillStyle = INK.pink; rr(g, 240, 10, 48, 40, 5); g.fill(); txt(g, 'IC', 264, 31, 20, '#fff', { weight: 900 }); } },
    { id: 'tvmLamp', w: 96, h: 26, draw: (g, w, h) => { g.fillStyle = '#1c2a22'; g.fillRect(0, 0, w, h); txt(g, '発売中', w / 2, h / 2 + 1, 16, '#79f59a', { weight: 900 }); } },
    { id: 'gateScr', w: 128, h: 48, draw: (g, w, h) => { g.fillStyle = '#16211d'; g.fillRect(0, 0, w, h); txt(g, 'IC 残額', 34, 15, 12, '#9ff0b4', { weight: 700 }); txt(g, '1,280円', 84, 33, 18, '#ffc27a', { weight: 900 }); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); } },
    { id: 'gateScr2', w: 128, h: 48, draw: (g, w, h) => { g.fillStyle = '#16211d'; g.fillRect(0, 0, w, h); txt(g, 'ようこそ', w / 2, 16, 13, '#9ff0b4', { weight: 700 }); txt(g, '桜ヶ丘', w / 2, 34, 16, '#ffc27a', { weight: 900 }); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); } },
    { id: 'exitGreen', w: 200, h: 76, draw: (g, w, h) => {
      g.fillStyle = '#2f9a5e'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4fbf6'; g.fillRect(118, 8, 74, 60); g.fillStyle = '#2f9a5e'; g.fillRect(150, 14, 36, 50);
      g.fillStyle = '#f4fbf6'; g.beginPath(); g.arc(66, 16, 8, 0, 7); g.fill(); g.lineCap = 'round'; g.strokeStyle = '#f4fbf6'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(62, 28); g.lineTo(54, 48); g.lineTo(38, 64); g.moveTo(54, 48); g.lineTo(72, 58); g.lineTo(76, 70); g.moveTo(60, 32); g.lineTo(78, 40); g.lineTo(90, 32); g.moveTo(60, 32); g.lineTo(44, 38); g.lineTo(34, 30); g.stroke();
      txt(g, '非常口', 154, 40, 14, '#2f9a5e', { weight: 900 });
    } },
    { id: 'aedSign', w: 160, h: 64, draw: (g, w, h) => { g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f9a5e'; rr(g, 6, 6, 56, 52, 6); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(34, 50); g.bezierCurveTo(8, 32, 16, 12, 34, 22); g.bezierCurveTo(52, 12, 60, 32, 34, 50); g.fill(); g.fillStyle = '#e8b030'; g.beginPath(); g.moveTo(36, 18); g.lineTo(28, 34); g.lineTo(35, 34); g.lineTo(30, 48); g.lineTo(42, 30); g.lineTo(35, 30); g.fill(); txt(g, 'AED', 110, 26, 26, '#2f9a5e', { weight: 900 }); txt(g, '自動体外式除細動器', 110, 50, 9, INK.ink, { weight: 700 }); } },
    lab('fireSign', 140, 44, INK.red, '#ffffff', '消火器', 24, { weight: 900, r: 2 }),
    lab('hydSign', 140, 44, INK.red, '#ffffff', '消火栓', 24, { weight: 900, r: 2 }),
    { id: 'alarmLb', w: 96, h: 128, draw: (g, w, h) => { g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f2ec'; g.fillRect(8, 8, w - 16, 30); txt(g, '火災報知機', w / 2, 23, 13, INK.red, { weight: 900 }); g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(w / 2, 76, 24, 0, 7); g.fill(); txt(g, '強く押す', w / 2, 112, 13, '#ffffff', { weight: 900 }); } },
    { id: 'emStop', w: 128, h: 128, draw: (g, w, h) => { g.fillStyle = '#f0c63a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f2c34'; for (let i = -2; i < 8; i++) { g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + 11, 0); g.lineTo(i * 22 - 9, 14); g.lineTo(i * 22 - 20, 14); g.fill(); } g.fillStyle = '#eeede9'; g.fillRect(8, 20, w - 16, h - 28); txt(g, '非常停止', w / 2, 44, 24, INK.red, { weight: 900 }); txt(g, 'ボタン', w / 2, 72, 22, INK.red, { weight: 900 }); txt(g, '緊急時に押してください', w / 2, 100, 10, INK.ink, { weight: 700 }); } },
    lab('bookSign', 220, 56, '#f4efe0', '#5a4032', 'えきなか文庫', 22, { sub: 'ご自由にお読みください・お持ち帰りOK' }),
    lab('paperSign', 150, 40, '#e5eef6', INK.navy, 'ご自由にお取りください', 13),
    { id: 'vmHead', w: 256, h: 72, draw: (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ef9fbe'); gr.addColorStop(1, '#f7c9d6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (const [x, y, s] of [[26, 22, 12], [228, 50, 10], [206, 18, 7]]) blossom(g, x, y, s, '#fdf0f4', '#ffffff'); txt(g, 'さくらドリンク', w / 2, 30, 28, '#ffffff', { weight: 900, font: F.round }); txt(g, 'SAKURA DRINK  つめた〜い・あったか〜い', w / 2, 56, 10, '#7a3050', { weight: 700 }); } },
    { id: 'vmTags', w: 320, h: 22, draw: (g, w, h) => { const p = [130, 130, 150, 160, 120, 140]; p.forEach((v, i) => { const x = i * (w / 6); g.fillStyle = '#f4f2ec'; g.fillRect(x + 2, 1, w / 6 - 4, h - 2); g.fillStyle = i < 2 ? INK.red : INK.blue; g.fillRect(x + 4, 4, 12, h - 8); txt(g, String(v), x + 34, h / 2 + 1, 13, INK.ink, { weight: 900 }); }); } },
    lab('vmCoin', 72, 22, '#e8eef2', INK.ink, '硬貨', 12),
    lab('vmTake', 150, 22, '#e8eef2', INK.ink, '取出口 TAKE OUT', 11),
    lab('keyLabel', 110, 28, '#eeede9', INK.ink, 'キーボックス', 13),
    lab('lockerA', 60, 22, '#eeede9', INK.ink, '駅長', 12),
    lab('lockerB', 60, 22, '#eeede9', INK.ink, '助役', 12),
    lab('lockerC', 60, 22, '#eeede9', INK.ink, '駅員', 12),
    lab('rampLabel', 120, 26, '#3a6fb8', '#ffffff', '車いす用スロープ', 11),
    lab('flagLabel', 90, 24, '#eeede9', INK.ink, '合図用具', 12),
  ];
  // spine labels: 8 cells (32 × 96 each, vertical text)
  const spines = { id: 'spines', w: 256, h: 96, draw: (g, w, h) => {
    const names = ['運転日報', '定期券', '遺失物', '点検記録', '旅客案内', '安全通達', '設備台帳', '精算記録'];
    names.forEach((s, i) => { const x = i * 32; g.fillStyle = '#f2efe6'; g.fillRect(x + 3, 0, 26, h); g.fillStyle = INK.ink; g.save(); T.verticalText(g, s, x + 16, 6, 18, F.sans, 700, 1.02); g.restore(); g.fillStyle = INK.pinkDeep; g.fillRect(x + 3, h - 8, 26, 3); });
  } };
  // ---------------------------------------------------------------- screens
  const screens = [
    { id: 'pcScr', w: 200, h: 128, draw: (g, w, h) => { g.fillStyle = '#eef3f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, 14); txt(g, '運転状況 / 業務日誌', 60, 8, 9, '#fff', { weight: 700 }); g.fillStyle = '#d7e0ea'; g.fillRect(0, 14, 40, h - 14); for (let i = 0; i < 6; i++) { g.fillStyle = i === 1 ? '#f7c9d6' : '#c3cfdc'; g.fillRect(4, 20 + i * 16, 32, 11); } g.strokeStyle = '#b8c4d2'; g.lineWidth = 1; for (let y = 24; y < h; y += 10) { g.beginPath(); g.moveTo(44, y); g.lineTo(w - 4, y); g.stroke(); } for (let x = 44; x < w; x += 38) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x, h - 4); g.stroke(); } const r = ctx.rng('pc'); g.fillStyle = '#34303f'; for (let y = 27; y < h - 6; y += 10) for (let x = 48; x < w - 20; x += 38) g.fillRect(x, y, 10 + r() * 20, 3); g.fillStyle = INK.red; g.fillRect(130, 57, 26, 4); } },
    { id: 'cctvScr', w: 200, h: 128, draw: (g, w, h) => { g.fillStyle = '#101218'; g.fillRect(0, 0, w, h); const pane = (x, y, pw, ph, seed) => { const r = ctx.rng(seed); g.fillStyle = '#5f6878'; g.fillRect(x, y, pw, ph); g.fillStyle = '#9aa3ae'; g.beginPath(); g.moveTo(x, y + ph); g.lineTo(x + pw * 0.55, y + ph * 0.45); g.lineTo(x + pw * 0.75, y + ph * 0.45); g.lineTo(x + pw * 0.62, y + ph); g.fill(); g.fillStyle = '#d8c060'; g.beginPath(); g.moveTo(x + pw * 0.62, y + ph); g.lineTo(x + pw * 0.75, y + ph * 0.45); g.lineTo(x + pw * 0.78, y + ph * 0.45); g.lineTo(x + pw * 0.68, y + ph); g.fill(); if (r() < 0.6) { g.fillStyle = '#d6d2c8'; g.fillRect(x + pw * 0.78, y + ph * 0.3, pw * 0.22, ph * 0.5); g.fillStyle = '#d88aa4'; g.fillRect(x + pw * 0.78, y + ph * 0.62, pw * 0.22, 3); } g.fillStyle = '#2c2f38'; g.fillRect(x + pw * 0.3 + r() * 20, y + ph * 0.5, 3, 9); g.fillStyle = '#e0e4ea'; txt(g, 'CAM' + seed.slice(-1), x + 14, y + 7, 7, '#e0e4ea', { weight: 700 }); }; pane(2, 2, 97, 61, 'c1'); pane(101, 2, 97, 61, 'c2'); pane(2, 65, 97, 61, 'c3'); pane(101, 65, 97, 61, 'c4'); txt(g, '16:02', w - 18, h - 6, 8, '#ffe070', { weight: 700 }); } },
    { id: 'termScr', w: 160, h: 100, draw: (g, w, h) => { g.fillStyle = '#dce8f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b4574'; g.fillRect(0, 0, w, 16); txt(g, '発券端末  SK07', w / 2, 9, 9, '#fff', { weight: 700 }); const b = ['乗車券', '定期券', '払戻し', '精算', '領収書', '回数券']; b.forEach((s, i) => { const x = 8 + (i % 3) * 50, y = 24 + Math.floor(i / 3) * 34; g.fillStyle = i === 1 ? '#f7c9d6' : '#ffffff'; g.strokeStyle = '#7d94b0'; g.lineWidth = 1.5; rr(g, x, y, 44, 28, 4); g.fill(); g.stroke(); txt(g, s, x + 22, y + 15, 10, INK.navy, { weight: 700 }); }); } },
    { id: 'custScr', w: 128, h: 64, draw: (g, w, h) => { g.fillStyle = '#16211d'; g.fillRect(0, 0, w, h); txt(g, 'いらっしゃいませ', w / 2, 18, 12, '#9ff0b4', { weight: 700 }); txt(g, '¥ 0', w / 2, 44, 20, '#ffc27a', { weight: 900 }); } },
    { id: 'radioFace', w: 96, h: 32, draw: (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5a4032'; g.lineWidth = 1; for (let x = 6; x < w - 6; x += 6) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, x % 18 === 0 ? 20 : 15); g.stroke(); } g.fillStyle = INK.red; g.fillRect(40, 5, 2, 20); txt(g, 'AM  FM', w / 2, 27, 7, '#5a4032', { weight: 700 }); } },
  ];
  // ---------------------------------------------------------------- paper goods
  const goods = [
    { id: 'clipPaper', w: 96, h: 128, draw: (g, w, h) => { paper(g, w, h, '#f4f2ec'); txt(g, '始業点検表', w / 2, 12, 11, INK.navy, { weight: 900 }); g.strokeStyle = '#9aa1a8'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const y = 26 + i * 11; g.strokeRect(8, y - 4, 7, 7); g.beginPath(); g.moveTo(20, y + 3); g.lineTo(w - 8, y + 3); g.stroke(); if (i < 6) { g.strokeStyle = '#c2456e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(9, y); g.lineTo(11, y + 2); g.lineTo(15, y - 4); g.stroke(); g.strokeStyle = '#9aa1a8'; g.lineWidth = 1; } } } },
    { id: 'clipPaper2', w: 96, h: 128, draw: (g, w, h) => { paper(g, w, h, '#f7f3e6'); txt(g, '忘れ物 受付簿', w / 2, 12, 10, INK.ink, { weight: 900 }); g.strokeStyle = '#b8c8dc'; g.lineWidth = 1; for (let y = 24; y < h; y += 9) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke(); } g.strokeStyle = '#555c70'; const r = ctx.rng('cp2'); for (let y = 22; y < 90; y += 9) { g.beginPath(); let x = 6; g.moveTo(x, y); while (x < w - 12 - r() * 30) { x += 3 + r() * 4; g.lineTo(x, y - 1 - r() * 2.5); g.lineTo(x + 1, y); } g.stroke(); } } },
    { id: 'news', w: 160, h: 112, draw: (g, w, h) => { paper(g, w, h, '#e9e6dc'); g.fillStyle = '#34303f'; txt(g, '桜ヶ丘新聞', 48, 14, 16, '#34303f', { weight: 900, font: F.serif }); g.fillStyle = INK.red; g.fillRect(100, 5, 52, 18); txt(g, '4月3日', 126, 14, 10, '#fff', { weight: 700 }); g.fillStyle = '#34303f'; g.fillRect(6, 28, w - 12, 2); txt(g, '桜川堤 満開に', 56, 42, 13, '#34303f', { weight: 900, font: F.serif }); g.fillStyle = '#b9b3a6'; g.fillRect(104, 34, 50, 38); g.fillStyle = '#e8b4c4'; g.beginPath(); g.arc(128, 48, 12, 0, 7); g.fill(); g.fillStyle = '#8a8478'; for (let y = 56; y < h - 4; y += 5) { g.fillRect(6, y, 92, 1.6); if (y > 76) g.fillRect(104, y, 50, 1.6); } } },
    { id: 'pamA', w: 72, h: 100, draw: (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f7d6e0'); gr.addColorStop(1, '#fbf2f5'); g.fillStyle = gr; g.fillRect(0, 0, w, h); blossom(g, 36, 40, 18); txt(g, '沿線', w / 2, 72, 13, '#c2456e', { weight: 900 }); txt(g, 'さくらめぐり', w / 2, 88, 10, INK.ink, { weight: 700 }); } },
    { id: 'pamB', w: 72, h: 100, draw: (g, w, h) => { g.fillStyle = '#e3f0f6'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fd1c1'; g.fillRect(0, 0, w, 30); txt(g, 'さくらライン', w / 2, 15, 11, '#2d5b52', { weight: 900 }); g.fillStyle = '#a3c48a'; g.beginPath(); g.moveTo(0, 80); g.bezierCurveTo(20, 60, 50, 70, w, 58); g.lineTo(w, h); g.lineTo(0, h); g.fill(); txt(g, '4月号', w / 2, 46, 12, INK.ink, { weight: 700 }); } },
    { id: 'pamC', w: 72, h: 100, draw: (g, w, h) => { g.fillStyle = '#fbf3dc'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9a23b'; g.fillRect(0, h - 26, w, 26); txt(g, 'ハイキング', w / 2, 24, 11, '#8a5a1a', { weight: 900 }); txt(g, 'マップ', w / 2, 40, 13, '#8a5a1a', { weight: 900 }); g.strokeStyle = '#c28a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 66); g.lineTo(28, 52); g.lineTo(44, 62); g.lineTo(62, 50); g.stroke(); txt(g, '桜川電鉄', w / 2, h - 13, 10, '#fff', { weight: 700 }); } },
    { id: 'dengon', w: 440, h: 250, draw: (g, w, h) => { // chalk message board (伝言板)
      g.fillStyle = '#3e5a4c'; g.fillRect(0, 0, w, h);
      const r = ctx.rng('dengon');
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(230,240,235,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * w, r() * h, 30 + r() * 60, 8 + r() * 16, r() * 3, 0, 7); g.fill(); }
      const ch = (s, x, y, size, c = '#eef2ea', rot = 0) => { g.save(); g.translate(x, y); g.rotate(rot); txt(g, s, 0, 0, size, c, { weight: 400, font: F.hand, align: 'left' }); g.restore(); };
      ch('伝 言 板', 160, 24, 24, '#f4f0dc');
      g.strokeStyle = 'rgba(240,240,230,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(150, 42); g.lineTo(290, 42); g.stroke();
      ch('ゆうなへ　先に堤に行ってるね　みお', 18, 74, 17, '#eef2ea', -0.02);
      ch('3時半　桜の木の下で待ってる', 30, 110, 17, '#f6c9d6', 0.015);
      ch('おかあさんへ　塾のあと帰ります', 16, 146, 16, '#eef2ea', -0.01);
      ch('おかえり！　今日も一日おつかれさま', 40, 186, 16, '#f2e38a', 0.01);
      ch('— 駅長', 330, 214, 15, '#f2e38a');
      ch('4/3', 390, 24, 14, '#eef2ea');
      g.fillStyle = 'rgba(240,240,230,0.35)'; for (let i = 0; i < 5; i++) g.fillRect(r() * w, r() * h, 12 + r() * 30, 2);
    } },
    { id: 'stampCard', w: 88, h: 60, draw: (g, w, h) => { paper(g, w, h, '#f4efe2'); g.strokeStyle = '#c4506e'; g.lineWidth = 2.5; g.beginPath(); g.arc(44, 30, 22, 0, 7); g.stroke(); g.fillStyle = '#c4506e'; g.beginPath(); g.moveTo(26, 38); g.lineTo(26, 30); g.lineTo(44, 20); g.lineTo(62, 30); g.lineTo(62, 38); g.fill(); txt(g, '桜ヶ丘駅', 44, 46, 7, '#c4506e', { weight: 900 }); } },
  ];

  const all = [...sheets, ...drawings, drawTitle, ...labels, spines, ...screens, ...goods].sort((p, q) => q.h - p.h || q.w - p.w);
  const N = makeAtlas(ctx, 'st-atlas-int', 1024, all);

  // soft radial light pool (white; tinted + faded by the material)
  const pool = T.draw(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.72)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { key: 'st-pool' });
  // cork tile (a real material surface, tiles 0.5 m)
  const cork = T.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('st-cork'); g.fillStyle = '#c89f6e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? `rgba(120,80,40,${0.15 + r() * 0.2})` : `rgba(235,205,160,${0.2 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
  }, { key: 'st-cork', repeat: [1, 1] });
  // wood grain for the waiting-room wainscot / benches (simplified painted grain, 1 m tile)
  const grain = T.draw(256, 256, (g, w, h) => {
    const r = ctx.rng('st-grain'); g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 34; i++) { const y = r() * h, a = 0.05 + r() * 0.08; g.strokeStyle = `rgba(90,60,40,${a})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3); g.stroke(); g.beginPath(); g.moveTo(0, y + h); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + h + Math.sin(x * 0.03 + i) * 3); g.stroke(); g.beginPath(); g.moveTo(0, y - h); for (let x = 0; x <= w; x += 32) g.lineTo(x, y - h + Math.sin(x * 0.03 + i) * 3); g.stroke(); }
  }, { key: 'st-grain', repeat: [1, 1] });
  return { N, pool, cork, grain };
}
