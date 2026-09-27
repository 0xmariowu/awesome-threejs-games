// Canvas textures for the E6 neighbourhood shrine (桜ヶ丘稲荷神社).
import { rr, sakuraFlower, vtext, ftext } from './common.js';

export const EMA = { W: 1024, H: 704, cw: 204, ch: 136, cols: 5, rows: 5 };

export function makeShrineTextures(ctx) {
  const T = ctx.tex, F = T.FONTS;
  const seeded = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  const gravel = T.draw(512, 512, (g, w, h) => {
    g.fillStyle = '#cdc8bd'; g.fillRect(0, 0, w, h);
    const r = seeded(11);
    const cols = ['#c2bcb0', '#dcd8cf', '#b7b0a4', '#e4e0d8', '#c9c0b0', '#aea89e', '#d4cbba'];
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, s = 2 + r() * 5;
      g.fillStyle = cols[(r() * cols.length) | 0];
      g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
      if (r() < 0.3) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.35, 0, Math.PI * 2); g.fill(); }
    }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(150,140,125,0.07)'; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 60, 30 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill(); }
  }, { key: 'props.shrine.gravel', repeat: [1, 1] });

  const stoneWall = T.draw(512, 256, (g, w, h) => {
    g.fillStyle = '#b8b2a6'; g.fillRect(0, 0, w, h);
    const r = seeded(5);
    // 布積み cut-stone courses
    const rows = 4, rh = h / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 60;
      while (x < w) {
        const bw = 70 + r() * 60;
        const c = 176 + ((r() * 26) | 0) - 12;
        g.fillStyle = `rgb(${c},${c - 5},${c - 14})`;
        rr(g, x + 3, i * rh + 3, bw - 6, rh - 6, 6); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, x + 5, i * rh + 5, bw - 10, 8, 4); g.fill();
        g.fillStyle = 'rgba(90,84,76,0.12)'; rr(g, x + 5, i * rh + rh - 14, bw - 10, 8, 4); g.fill();
        x += bw;
      }
    }
    // moss / damp at the bottom
    const gr = g.createLinearGradient(0, h * 0.6, 0, h); gr.addColorStop(0, 'rgba(120,140,90,0)'); gr.addColorStop(1, 'rgba(110,132,84,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { key: 'props.shrine.stonewall', repeat: [1, 1] });

  const stone = T.draw(256, 256, (g, w, h) => {
    g.fillStyle = '#c6c1b6'; g.fillRect(0, 0, w, h);
    const r = seeded(21);
    for (let i = 0; i < 40; i++) { // very soft irregular washes
      const x = r() * w, y = r() * h, rad = 30 + r() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.5 ? '120,112,100' : '255,252,244';
      gr.addColorStop(0, `rgba(${c},0.045)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 1400; i++) { const c = 150 + ((r() * 90) | 0); g.fillStyle = `rgba(${c},${c - 4},${c - 10},0.45)`; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
    for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(110,104,96,0.06)'; g.lineWidth = 1 + r() * 2; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 10, w * 0.7, y + (r() - 0.5) * 10, w, y); g.stroke(); }
  }, { key: 'props.shrine.stone', repeat: [1, 1] });

  const wood = T.draw(256, 256, (g, w, h) => {
    g.fillStyle = '#b08b64'; g.fillRect(0, 0, w, h);
    const r = seeded(31);
    for (let i = 0; i < 40; i++) { const x = r() * w; g.strokeStyle = `rgba(110,78,52,${0.12 + r() * 0.16})`; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 20, h * 0.3, x + (r() - 0.5) * 20, h * 0.7, x + (r() - 0.5) * 10, h); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,240,220,0.08)'; g.fillRect(r() * w, 0, 6 + r() * 14, h); }
  }, { key: 'props.shrine.wood', repeat: [1, 1] });

  const rope = T.draw(128, 32, (g, w, h) => {
    g.fillStyle = '#d8c690'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b39b62'; g.lineWidth = 5;
    for (let x = -h; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); }
    g.strokeStyle = 'rgba(255,248,220,0.6)'; g.lineWidth = 2;
    for (let x = -h + 6; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); }
  }, { key: 'props.shrine.rope', repeat: [6, 1] });

  // torii plaque 額 (black lacquer, gold rim + text)
  const gaku = T.draw(128, 192, (g, w, h) => {
    g.fillStyle = '#3f3a48'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b862'; g.lineWidth = 7; g.strokeRect(6, 6, w - 12, h - 12);
    g.lineWidth = 2; g.strokeRect(15, 15, w - 30, h - 30);
    vtext(g, '稲荷神社', w / 2, 22, 36, F.brush, 700, 1.02, '#e8c874');
  }, { key: 'props.shrine.gaku' });

  // engraved shrine name pillar 社号標 (alpha decal)
  const shagou = T.draw(128, 768, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    vtext(g, '桜ヶ丘稲荷神社', w / 2, 24, 86, F.brush, 700, 1.03, 'rgba(70,64,72,0.82)');
  }, { key: 'props.shrine.shagou' });
  const kenno = (name, i) => T.draw(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    vtext(g, '奉納', w / 2, 8, 22, F.serif, 700, 1.0, 'rgba(78,72,78,0.75)');
    vtext(g, name, w / 2, 62, 20, F.serif, 700, 1.0, 'rgba(78,72,78,0.75)');
  }, { key: 'props.shrine.kenno' + i });
  const kennoTex = ['山田商店', '桜ヶ丘町内会', '中村家', '鈴木工務店'].map(kenno);

  // red nobori 正一位稲荷大明神
  const nobori = (donor, i) => T.draw(128, 512, (g, w, h) => {
    g.fillStyle = '#d6503f'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, 0, 10, h);
    ftext(g, '奉納', w / 2, 30, 90, 26, F.serif, 900, '#fbf2e6');
    vtext(g, '正一位稲荷大明神', w / 2, 60, 46, F.brush, 700, 0.97, '#fbf6ee');
    ftext(g, donor, w / 2, h - 18, 110, 14, F.serif, 700, '#fbe9d8');
  }, { key: 'props.shrine.nobori' + i });
  const noboriTex = ['桜ヶ丘町内会', '有志一同', '山本米店', '駅前商店会'].map(nobori);

  // hokora doors (lattice + gold fittings)
  const doors = T.draw(256, 256, (g, w, h) => {
    g.fillStyle = '#a07d58'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6e5238'; g.fillRect(w / 2 - 3, 0, 6, h);
    g.fillStyle = '#5d4632'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
    g.strokeStyle = '#6e5238'; g.lineWidth = 5;
    for (const x0 of [22, w / 2 + 12]) { for (let x = x0; x < x0 + 100; x += 22) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, h * 0.55); g.stroke(); } g.beginPath(); g.moveTo(x0 - 6, h * 0.55); g.lineTo(x0 + 96, h * 0.55); g.stroke(); }
    g.fillStyle = '#d9b862';
    for (const x of [w / 2 - 20, w / 2 + 8]) { g.beginPath(); g.arc(x + 6, h * 0.72, 9, 0, Math.PI * 2); g.fill(); }
    for (const [x, y] of [[12, 12], [w - 36, 12], [12, h - 36], [w - 36, h - 36]]) { g.fillRect(x, y, 24, 24); }
    g.fillStyle = '#b89548'; g.beginPath(); g.arc(w / 2, h * 0.36, 16, 0, Math.PI * 2); g.fill();
  }, { key: 'props.shrine.doors' });

  // 賽銭箱 front
  const saisen = T.draw(256, 160, (g, w, h) => {
    g.fillStyle = '#7b5a3f'; g.fillRect(0, 0, w, h);
    const r = seeded(41); for (let i = 0; i < 20; i++) { g.strokeStyle = `rgba(60,40,28,${0.15 + r() * 0.15})`; g.lineWidth = 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); g.stroke(); }
    g.fillStyle = '#d9b862';
    for (const [x, y] of [[0, 0], [w - 26, 0], [0, h - 26], [w - 26, h - 26]]) g.fillRect(x, y, 26, 26);
    ftext(g, '奉　納', w / 2, h * 0.55, w * 0.8, 70, F.brush, 700, '#f1dfae');
  }, { key: 'props.shrine.saisen' });

  // 手水鉢 front engraving (alpha)
  const chozu = T.draw(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); ftext(g, '奉　納', w / 2 + 2, h / 2 + 6, w * 0.8, 64, F.brush, 700, 'rgba(255,255,255,0.35)'); ftext(g, '奉　納', w / 2, h / 2 + 4, w * 0.8, 64, F.brush, 700, 'rgba(84,78,84,0.55)'); }, { key: 'props.shrine.chozu' });
  const water = T.draw(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#a9cfd9'); gr.addColorStop(1, '#7fb0c2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(w * 0.72, h * 0.35, 18 + i * 16, 8 + i * 7, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(w * 0.1, h * 0.7, w * 0.3, 4); g.fillRect(w * 0.2, h * 0.8, w * 0.2, 3);
  }, { key: 'props.shrine.water' });

  // 地蔵尊 plaque + 絵馬掛所 board
  const board = (text, key, vertical = true, w = 64, h = 192, size = 40) => T.draw(w, h, (g) => {
    g.fillStyle = '#c9a77c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6446'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    if (vertical) vtext(g, text, w / 2, 12, size, F.brush, 700, 1.02, '#3f3346');
    else ftext(g, text, w / 2, h / 2 + 2, w * 0.9, size, F.brush, 700, '#3f3346');
  }, { key: 'props.shrine.board.' + key });
  const jizoPlaque = board('地蔵尊', 'jizo');
  const emaSign = board('絵馬掛所', 'ema', false, 256, 64, 40);

  // community notice board with posters (1024x640)
  const notice = T.draw(1024, 640, (g, w, h) => {
    g.fillStyle = '#6f8f6a'; g.fillRect(0, 0, w, h);
    const r = seeded(51);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,60,40'},0.05)`; g.fillRect(r() * w, r() * h, 3, 3); }
    const pin = (x, y, c = '#d9463b') => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2); g.fill(); };
    // 1. last year's summer festival (faded, sun-bleached, a curled corner)
    g.save(); g.translate(40, 34); g.rotate(-0.02);
    { const pw = 360, ph = 540;
      const gr = g.createLinearGradient(0, 0, 0, ph); gr.addColorStop(0, '#5f6f9e'); gr.addColorStop(1, '#8c7fa6');
      g.fillStyle = gr; g.fillRect(0, 0, pw, ph);
      // fireworks
      for (const [x, y, rad, c] of [[90, 120, 60, '#f3c9a0'], [260, 90, 46, '#f0b3c0'], [200, 200, 36, '#e9e0a8']]) {
        g.strokeStyle = c; g.lineWidth = 4; for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8; g.beginPath(); g.moveTo(x + Math.cos(an) * rad * 0.3, y + Math.sin(an) * rad * 0.3); g.lineTo(x + Math.cos(an) * rad, y + Math.sin(an) * rad); g.stroke(); }
      }
      // lanterns row
      for (let i = 0; i < 7; i++) { g.fillStyle = '#e59a7a'; g.beginPath(); g.ellipse(30 + i * 50, 300, 16, 22, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#3f3a48'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 276); g.quadraticCurveTo(pw / 2, 290, pw, 276); g.stroke();
      ftext(g, '桜ヶ丘', pw / 2, 350, pw * 0.8, 44, F.brush, 700, '#f4ecdf');
      ftext(g, '夏まつり', pw / 2, 410, pw * 0.9, 76, F.brush, 700, '#fbe7c8');
      ftext(g, '令和7年 8月2日(土)・3日(日)', pw / 2, 466, pw * 0.9, 24, F.sans, 900, '#f4ecdf');
      ftext(g, '盆踊り・夜店・花火　会場 桜ヶ丘稲荷神社／駅前広場', pw / 2, 498, pw * 0.94, 14, F.sans, 700, '#e8e0d4');
      ftext(g, '主催 桜ヶ丘町内会', pw / 2, 522, pw * 0.8, 14, F.sans, 700, '#e8e0d4');
      g.fillStyle = 'rgba(246,238,222,0.42)'; g.fillRect(0, 0, pw, ph); // sun-faded
      g.fillStyle = 'rgba(246,238,222,0.3)'; g.fillRect(0, ph * 0.55, pw, ph * 0.45);
      g.fillStyle = '#e9e1d2'; g.beginPath(); g.moveTo(pw, ph); g.lineTo(pw - 44, ph); g.lineTo(pw, ph - 50); g.fill(); // curled corner
    }
    g.restore(); pin(56, 44); pin(384, 40);
    // 2. 桜まつり (current)
    g.save(); g.translate(430, 30); g.rotate(0.015);
    { const pw = 290, ph = 300; g.fillStyle = '#fbeef2'; g.fillRect(0, 0, pw, ph);
      for (const [x, y, rad] of [[40, 50, 26], [250, 70, 20], [60, 250, 18], [240, 250, 28], [150, 40, 14]]) sakuraFlower(g, x, y, rad, '#f2a5bd', '#e0708f');
      ftext(g, '桜まつり', pw / 2, 120, pw * 0.86, 58, F.brush, 700, '#c9557a');
      ftext(g, '4月4日(土)・5日(日)', pw / 2, 182, pw * 0.86, 26, F.sans, 900, '#5a4a5e');
      ftext(g, 'ぼんぼり点灯 18:00〜21:00', pw / 2, 218, pw * 0.86, 18, F.sans, 700, '#5a4a5e');
      ftext(g, '駅前広場・桜川堤', pw / 2, 246, pw * 0.86, 18, F.sans, 700, '#5a4a5e');
    }
    g.restore(); pin(440, 38, '#3f7bd0'); pin(712, 42, '#3f7bd0');
    // 3. 町内一斉清掃
    g.save(); g.translate(746, 36); g.rotate(-0.03);
    { const pw = 240, ph = 220; g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, pw, ph);
      g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, pw, 44);
      ftext(g, 'お知らせ', pw / 2, 23, pw * 0.8, 26, F.sans, 900, '#ffffff');
      ftext(g, '町内一斉清掃', pw / 2, 78, pw * 0.9, 30, F.sans, 900, '#2f5a3f');
      ftext(g, '4月19日(日) 午前8時〜', pw / 2, 118, pw * 0.9, 18, F.sans, 700, '#3a3346');
      ftext(g, '集合：稲荷神社前', pw / 2, 146, pw * 0.9, 18, F.sans, 700, '#3a3346');
      ftext(g, '軍手・ごみ袋は用意します', pw / 2, 178, pw * 0.9, 14, F.sans, 500, '#3a3346');
      ftext(g, '桜ヶ丘町内会', pw / 2, 202, pw * 0.9, 13, F.sans, 700, '#6d6a80');
    }
    g.restore(); pin(868, 44, '#e8c547');
    // 4. 春の交通安全運動
    g.save(); g.translate(440, 360); g.rotate(-0.01);
    { const pw = 300, ph = 250; g.fillStyle = '#fff6d8'; g.fillRect(0, 0, pw, ph);
      g.fillStyle = '#e8a23b'; g.fillRect(0, 0, pw, 18); g.fillRect(0, ph - 18, pw, 18);
      ftext(g, '春の全国交通安全運動', pw / 2, 52, pw * 0.92, 26, F.sans, 900, '#c24a2c');
      ftext(g, '4月6日(月)〜15日(水)', pw / 2, 92, pw * 0.9, 22, F.sans, 900, '#3a3346');
      // child + yellow hat pictogram
      g.fillStyle = '#f2c230'; g.beginPath(); g.arc(80, 160, 24, Math.PI, 0); g.fill();
      g.fillStyle = '#f4d7c0'; g.beginPath(); g.arc(80, 170, 18, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f7bd0'; rr(g, 60, 190, 40, 36, 8); g.fill();
      ftext(g, 'とび出し注意！', 200, 160, 170, 24, F.round, 900, '#3a3346');
      ftext(g, '桜ヶ丘警察署', 200, 200, 170, 16, F.sans, 700, '#6d6a80');
    }
    g.restore(); pin(588, 368);
    // 5. 防犯パトロール (small)
    g.save(); g.translate(768, 290); g.rotate(0.03);
    { const pw = 220, ph = 300; g.fillStyle = '#eef3fb'; g.fillRect(0, 0, pw, ph);
      g.fillStyle = '#2f64b5'; g.fillRect(0, 0, pw, 60);
      ftext(g, '防犯パトロール', pw / 2, 30, pw * 0.9, 26, F.sans, 900, '#ffffff');
      ftext(g, '隊員募集中', pw / 2, 96, pw * 0.9, 30, F.sans, 900, '#2f64b5');
      ftext(g, '毎週水曜 19時〜', pw / 2, 140, pw * 0.9, 18, F.sans, 700, '#3a3346');
      ftext(g, '夕方の見守りに', pw / 2, 170, pw * 0.9, 18, F.sans, 700, '#3a3346');
      ftext(g, 'ご協力ください', pw / 2, 196, pw * 0.9, 18, F.sans, 700, '#3a3346');
      g.fillStyle = '#f2c230'; rr(g, 30, 230, pw - 60, 40, 8); g.fill();
      ftext(g, '桜ヶ丘町 自治会', pw / 2, 250, pw * 0.8, 16, F.sans, 900, '#3a3346');
    }
    g.restore(); pin(876, 298, '#3f8f5b');
  }, { key: 'props.shrine.notice', anisotropy: 8 });
  const noticeHead = T.draw(512, 64, (g, w, h) => {
    g.fillStyle = '#5a4032'; g.fillRect(0, 0, w, h);
    ftext(g, '桜ヶ丘町内会　掲示板', w / 2, h / 2 + 2, w * 0.9, 38, F.serif, 900, '#f3e6cc');
  }, { key: 'props.shrine.noticehead' });

  // ema atlas: wish side (front) of 24 plaques + plain wood back
  const WISHES = [
    ['合格祈願', '第一志望に', '合格できますように', 'ゆうと'],
    ['家内安全', '家族みんなが', '元気で過ごせますように', '中村'],
    ['恋愛成就', '先輩と', 'もっと話せますように', 'み'],
    ['商売繁盛', 'お店が', '長く続きますように', '山田商店'],
    ['無病息災', 'おばあちゃんが', 'ずっと元気でいますように', 'さくら'],
    ['必勝祈願', '夏の大会で', '県大会に行けますように！', '桜ヶ丘中 野球部'],
    ['交通安全', '毎日の通学が', '安全でありますように', 'はると'],
    ['安産祈願', '元気な赤ちゃんが', '生まれますように', '佐藤'],
    ['学業成就', '数学のテストで', '80点とれますように', 'りこ'],
    ['心願成就', '絵がもっと', '上手になりますように', 'あおい'],
    ['健康第一', 'ことしこそ', '禁煙できますように', 'パパ'],
    ['良縁祈願', 'すてきな人と', '出会えますように', 'K'],
    ['合格祈願', '看護学校に', '受かりますように', 'まい'],
    ['家内安全', 'ポチが', '長生きしますように', 'けんた'],
    ['諸願成就', '友だちと', 'また同じクラスに', 'ひな'],
    ['開運招福', 'いい一年に', 'なりますように', '鈴木'],
    ['学業成就', 'ピアノの発表会', 'うまくいきますように', 'ゆい'],
    ['商売繁盛', '新しいパン屋が', 'うまくいきますように', 'ベーカリー 小春'],
    ['無病息災', 'みんな', '笑顔でいられますように', '田中家'],
    ['合格祈願', '運転免許', '一発合格！', 'そうた'],
    ['心願成就', '東京の大学で', 'がんばれますように', 'れん'],
    ['縁結び', '大好きな人と', 'ずっと一緒に', 'M&S'],
    ['必勝祈願', '吹奏楽コンクール', '金賞！', '桜ヶ丘高校'],
    ['家内安全', '新しい家で', '仲よく暮らせますように', '小林'],
  ];
  const ema = T.draw(EMA.W, EMA.H, (g) => {
    g.fillStyle = '#d9bf93'; g.fillRect(0, 0, EMA.W, EMA.H);
    const r = seeded(61);
    const sc = EMA.cw / 256;
    WISHES.forEach((wsh, i) => {
      const x = (i % EMA.cols) * EMA.cw, y = Math.floor(i / EMA.cols) * EMA.ch;
      g.save(); g.beginPath(); g.rect(x, y, EMA.cw, EMA.ch); g.clip(); g.translate(x, y); g.scale(sc, sc);
      const w = 256, h = 170;
      g.fillStyle = ['#e2c99d', '#dcc091', '#e6d1a8'][i % 3]; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 10; k++) { g.strokeStyle = `rgba(150,110,70,${0.08 + r() * 0.1})`; g.lineWidth = 1.5; g.beginPath(); const yy = r() * h; g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + 3, w * 0.7, yy - 3, w, yy + 1); g.stroke(); }
      // printed motif (fox mask + sakura) near the top
      g.fillStyle = '#c9553f'; g.fillRect(0, 0, w, 6);
      g.fillStyle = '#d6503f'; g.beginPath(); g.moveTo(w / 2 - 18, 36); g.lineTo(w / 2 - 11, 16); g.lineTo(w / 2 - 4, 30); g.lineTo(w / 2 + 4, 30); g.lineTo(w / 2 + 11, 16); g.lineTo(w / 2 + 18, 36); g.lineTo(w / 2, 50); g.closePath(); g.fill();
      sakuraFlower(g, w / 2 - 44, 34, 11, '#e98aa6', '#fbe3ea'); sakuraFlower(g, w / 2 + 44, 34, 11, '#e98aa6', '#fbe3ea');
      const ink = i % 5 === 2 ? '#2f4f8f' : i % 7 === 3 ? '#7a2f3a' : '#2e2a36';
      ftext(g, wsh[0], w / 2, 70, w * 0.8, 28, F.brush, 700, ink);
      ftext(g, wsh[1], w / 2, 103, w * 0.86, 22, F.hand, 400, ink);
      ftext(g, wsh[2], w / 2, 130, w * 0.92, 20, F.hand, 400, ink);
      ftext(g, wsh[3], w * 0.76, 156, w * 0.44, 16, F.hand, 400, ink);
      g.restore();
    });
    // plain wooden back (cell 24) with the shrine stamp
    { const x = 4 * EMA.cw, y = 4 * EMA.ch; g.fillStyle = '#dcc293'; g.fillRect(x, y, EMA.cw, EMA.ch);
      g.fillStyle = 'rgba(200,70,60,0.8)'; g.beginPath(); g.arc(x + EMA.cw / 2, y + 70, 22, 0, Math.PI * 2); g.fill();
      ftext(g, '稲荷', x + EMA.cw / 2, y + 71, 38, 20, F.brush, 700, '#fbe9dc'); }
  }, { key: 'props.shrine.ema', anisotropy: 8 });

  return { gravel, stoneWall, stone, wood, rope, gaku, shagou, kennoTex, noboriTex, doors, saisen, chozu, water, jizoPlaque, emaSign, notice, noticeHead, ema, emaBack: [4 * EMA.cw, 4 * EMA.ch, EMA.cw, EMA.ch], wishes: WISHES.length };
}
