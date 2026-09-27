// Sign / poster / board canvases for the plaza (real, natural Japanese; fictional organisations only).
import * as L from '../layout.js';

export function makeSigns(ctx, T) {
  const { tex } = ctx;
  const F = tex.FONTS;
  const S = {};
  const rng = ctx.rng('plaza-signs');

  const txt = (g, s, x, y, size, font, color, weight = 700, align = 'center', base = 'middle', maxW = 0) => {
    g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
    if (maxW) tex.fitText(g, s, x, y, maxW, size, font, weight);
    else { g.font = `${weight} ${size}px ${font}`; g.fillText(s, x, y); }
  };
  const rr = (g, x, y, w, h, r, fill, stroke, lw = 2) => {
    tex.roundRect(g, x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  };
  const vtxt = (g, s, x, y, size, font, color, weight = 700, gap = 1.08) => { g.fillStyle = color; tex.verticalText(g, s, x, y, size, font, weight, gap); };
  const busIcon = (g, x, y, s, col = '#ffffff', bg = null) => {
    if (bg) rr(g, x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2, s * 0.18, bg);
    rr(g, x - s * 0.42, y - s * 0.4, s * 0.84, s * 0.66, s * 0.12, col);
    g.fillStyle = bg || '#3a3346';
    g.fillRect(x - s * 0.34, y - s * 0.32, s * 0.68, s * 0.26);
    g.fillStyle = col; g.beginPath(); g.arc(x - s * 0.24, y + s * 0.3, s * 0.1, 0, 7); g.arc(x + s * 0.24, y + s * 0.3, s * 0.1, 0, 7); g.fill();
  };
  const taxiIcon = (g, x, y, s, col = '#ffffff', bg = null) => {
    if (bg) rr(g, x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2, s * 0.18, bg);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - s * 0.5, y + s * 0.18); g.lineTo(x - s * 0.44, y - s * 0.04); g.lineTo(x - s * 0.26, y - s * 0.08);
    g.lineTo(x - s * 0.16, y - s * 0.28); g.lineTo(x + s * 0.18, y - s * 0.28); g.lineTo(x + s * 0.3, y - s * 0.08); g.lineTo(x + s * 0.46, y - s * 0.04); g.lineTo(x + s * 0.5, y + s * 0.18); g.closePath(); g.fill();
    g.fillRect(x - s * 0.08, y - s * 0.4, s * 0.16, s * 0.1);
    g.fillStyle = bg || '#3a3346'; g.fillRect(x - s * 0.12, y - s * 0.23, s * 0.1, s * 0.13); g.fillRect(x + s * 0.03, y - s * 0.23, s * 0.12, s * 0.13);
    g.fillStyle = col; g.beginPath(); g.arc(x - s * 0.28, y + s * 0.22, s * 0.1, 0, 7); g.arc(x + s * 0.28, y + s * 0.22, s * 0.1, 0, 7); g.fill();
  };
  const bikeIcon = (g, x, y, s, col = '#ffffff') => {
    g.strokeStyle = col; g.lineWidth = s * 0.07; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.arc(x - s * 0.3, y + s * 0.12, s * 0.2, 0, 7); g.stroke();
    g.beginPath(); g.arc(x + s * 0.3, y + s * 0.12, s * 0.2, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(x - s * 0.3, y + s * 0.12); g.lineTo(x - s * 0.08, y - s * 0.16); g.lineTo(x + s * 0.18, y - s * 0.16); g.lineTo(x + s * 0.3, y + s * 0.12);
    g.moveTo(x - s * 0.3, y + s * 0.12); g.lineTo(x + s * 0.02, y + s * 0.12); g.lineTo(x + s * 0.18, y - s * 0.16);
    g.moveTo(x - s * 0.08, y - s * 0.16); g.lineTo(x - s * 0.12, y - s * 0.26); g.moveTo(x - s * 0.2, y - s * 0.26); g.lineTo(x - s * 0.04, y - s * 0.26);
    g.moveTo(x + s * 0.18, y - s * 0.16); g.lineTo(x + s * 0.14, y - s * 0.3); g.lineTo(x + s * 0.24, y - s * 0.3); g.stroke();
  };
  const pIcon = (g, x, y, s) => { rr(g, x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2, s * 0.16, '#2f64b5'); txt(g, 'P', x, y + s * 0.04, s * 0.95, F.sans, '#f4f4f0', 900); };
  const postIcon = (g, x, y, s) => { g.fillStyle = '#d9463b'; g.beginPath(); g.arc(x, y, s * 0.55, 0, 7); g.fill(); txt(g, '〒', x, y + s * 0.04, s * 0.72, F.sans, '#f7f3ea', 900); };
  const telIcon = (g, x, y, s) => { rr(g, x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1, s * 0.16, '#3f8f5b'); txt(g, '☎', x, y + s * 0.05, s * 0.8, F.sans, '#f4f4f0', 700); };
  const wcIcon = (g, x, y, s) => { rr(g, x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1, s * 0.16, '#5f7fa8'); txt(g, 'WC', x, y + s * 0.04, s * 0.5, F.en, '#f4f4f0', 900); };
  const toriiIcon = (g, x, y, s) => {
    g.fillStyle = '#d9463b';
    g.fillRect(x - s * 0.55, y - s * 0.42, s * 1.1, s * 0.12); g.fillRect(x - s * 0.42, y - s * 0.22, s * 0.84, s * 0.08);
    g.fillRect(x - s * 0.34, y - s * 0.34, s * 0.1, s * 0.8); g.fillRect(x + s * 0.24, y - s * 0.34, s * 0.1, s * 0.8);
  };
  S.icons = { busIcon, taxiIcon, bikeIcon, pIcon, postIcon, telIcon };

  // =============================================================== 駅周辺案内図 (station area map)
  S.map = tex.draw(1024, 768, (g, W, H) => {
    g.fillStyle = '#efebe0'; g.fillRect(0, 0, W, H);
    // header
    g.fillStyle = '#33507a'; g.fillRect(0, 0, W, 92);
    txt(g, '駅周辺案内図', 34, 48, 54, F.sans, '#f3f1ea', 900, 'left');
    txt(g, 'Sakuragaoka Station Area Map', 380, 60, 24, F.en, '#cfdcef', 500, 'left');
    rr(g, 770, 22, 230, 50, 25, '#ef9fbe'); txt(g, '桜川線  桜ヶ丘駅', 885, 48, 25, F.sans, '#3a3346', 900);
    // map frame
    const mx0 = 24, my0 = 108, mw = 700, mh = 640;
    g.save(); g.beginPath(); g.rect(mx0, my0, mw, mh); g.clip();
    const k = 3.9, cx = mx0 + mw / 2 - 20;
    const X = (x) => cx + x * k, Y = (z) => my0 + (z + 118) * k;
    const R = (x0, z0, x1, z1, col) => { g.fillStyle = col; g.fillRect(X(x0), Y(z0), (x1 - x0) * k, (z1 - z0) * k); };
    g.fillStyle = '#e9ecdd'; g.fillRect(mx0, my0, mw, mh);
    // far fields, river, levee
    R(-120, -140, 120, -116, '#d6e6c2');
    R(-120, -116, 120, -101, '#a8cfe6');
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = -85 + i * 21; g.beginPath(); g.moveTo(X(x), Y(-109)); g.quadraticCurveTo(X(x + 4), Y(-111.5), X(x + 8), Y(-109)); g.stroke(); }
    txt(g, '桜 川', X(-40), Y(-108.5), 24, F.sans, '#3c6f96', 900);
    R(-120, -101, 120, -84, '#cfe3b6');
    R(-120, -94.5, 120, -91.5, '#efe6cf');
    for (let x = -88; x <= 88; x += 7) { T.sakuraIcon(g, X(x), Y(-97.5), 7); T.sakuraIcon(g, X(x + 3.5), Y(-88), 7); }
    txt(g, '桜川堤 桜並木', X(34), Y(-84.5) + 14, 20, F.sans, '#b24a70', 900);
    // houses
    const house = '#f4e6c3';
    for (const b of L.BLOCKS) {
      g.fillStyle = house; g.fillRect(X(b.x0), Y(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
      g.strokeStyle = 'rgba(200,180,140,0.6)'; g.lineWidth = 1;
      for (let x = b.x0 + 9; x < b.x1; x += 10) { g.beginPath(); g.moveTo(X(x), Y(b.z0)); g.lineTo(X(x), Y(b.z1)); g.stroke(); }
    }
    for (const lot of L.LOTS) {
      if (lot.z0 > 44) continue;
      const x0 = lot.side < 0 ? -18.8 : 4.8, x1 = lot.side < 0 ? -4.8 : 18.8;
      const shop = lot.owner !== 'houses';
      g.fillStyle = shop ? '#f7d9c4' : house; g.fillRect(X(x0), Y(lot.z0) + 1, (x1 - x0) * k, (lot.z1 - lot.z0) * k - 2);
    }
    // roads
    g.fillStyle = '#ffffff';
    R(-120, -57.5, 120, -53.5, '#ffffff'); R(-120, -72.5, 120, -69.5, '#ffffff');
    R(-14.75, -88, -9.25, -5, '#ffffff'); R(-120, -5, 120, 1, '#ffffff'); R(-3, 1, 3, 60, '#ffffff');
    // rail corridor
    R(-120, -52, 120, -34, '#dedad2');
    g.fillStyle = '#6a6470'; g.fillRect(mx0, Y(-44) - 4, mw, 8); g.fillRect(mx0, Y(-42) - 4, mw, 8);
    g.fillStyle = '#ef9fbe'; g.fillRect(mx0, Y(-43) - 3, mw, 6);
    g.fillStyle = '#ffffff'; for (let x = mx0; x < mx0 + mw; x += 22) { g.fillRect(x, Y(-44) - 1.5, 11, 3); g.fillRect(x + 11, Y(-42) - 1.5, 11, 3); }
    R(-7, -39.5, 40, -35.5, '#c9c7c2'); R(-7, -50.5, 40, -46.5, '#c9c7c2');
    // crossing
    R(-14.75, -48, -9.25, -38, '#ffffff');
    g.strokeStyle = '#d9463b'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(-17), Y(-38)); g.lineTo(X(-19.5), Y(-35.5)); g.moveTo(X(-19.5), Y(-38)); g.lineTo(X(-17), Y(-35.5)); g.stroke();
    txt(g, '踏切', X(-24), Y(-36.5), 17, F.sans, '#9a3a33', 900);
    // station
    g.fillStyle = '#ef9fbe'; g.fillRect(X(-4), Y(-35.5), 16 * k, 10.5 * k);
    g.strokeStyle = '#c96b8c'; g.lineWidth = 2; g.strokeRect(X(-4), Y(-35.5), 16 * k, 10.5 * k);
    txt(g, '桜ヶ丘駅', X(4), Y(-30.3), 17, F.sans, '#3a3346', 900);
    txt(g, '← 花見台', X(-58), Y(-47.5) - 6, 17, F.sans, '#4a4453', 700);
    txt(g, '春日野 →', X(62), Y(-38.5) + 6, 17, F.sans, '#4a4453', 700);
    txt(g, '桜川線', X(-40), Y(-37.5) + 3, 16, F.sans, '#b24a70', 900);
    // plaza
    g.fillStyle = '#e4e0d4'; g.fillRect(X(-9.25), Y(-25), 35.25 * k, 20 * k);
    g.fillStyle = '#dcd6c8'; g.fillRect(X(-4), Y(-25), 18 * k, 4.5 * k);
    R(16, -16, 25.4, -8.5, '#cfd7e6');
    // tree
    T.sakuraIcon(g, X(-3), Y(-14), 11);
    // facilities
    busIcon(g, X(8), Y(-8.2), 16, '#ffffff', '#e0799c');
    taxiIcon(g, X(-6.6), Y(-8.4), 16, '#ffffff', '#33507a');
    pIcon(g, X(20.7), Y(-12.2), 14);
    postIcon(g, X(-2.8), Y(-6.4) + 2, 11);
    telIcon(g, X(14.2), Y(-18.2), 11);
    // you are here
    const hx = X(1.6), hy = Y(-19.2);
    g.fillStyle = 'rgba(217,70,59,0.25)'; g.beginPath(); g.arc(hx, hy, 15, 0, 7); g.fill();
    g.fillStyle = '#d9463b'; g.beginPath(); g.arc(hx, hy, 7, 0, 7); g.fill();
    g.strokeStyle = '#f7f3ea'; g.lineWidth = 2; g.stroke();
    rr(g, hx + 8, hy - 42, 94, 30, 8, '#d9463b');
    txt(g, '現在地', hx + 55, hy - 27, 19, F.sans, '#f7f3ea', 900);
    // street names & shops
    g.save(); g.translate(X(0), Y(33)); g.fillStyle = '#6a5a52'; tex.verticalText(g, '駅前商店街', 0, -45, 15, F.sans, 900, 1.05); g.restore();
    txt(g, '駅前通り', X(-45), Y(-2), 15, F.sans, '#6a5a52', 900);
    const shopLabel = (id, name) => {
      const lot = L.lotById(id); const zc = (lot.z0 + lot.z1) / 2;
      const x = lot.side < 0 ? X(-11.8) : X(11.8);
      txt(g, name, x, Y(zc), 15, F.sans, '#6a4a3c', 900);
    };
    shopLabel('W1', 'コンビニ'); shopLabel('W2', '花屋'); shopLabel('W4', '書店'); shopLabel('E1', '喫茶'); shopLabel('E2', '和菓子'); shopLabel('E3', 'よろず屋');
    T.sakuraIcon(g, X(-7), Y(25.2), 7);
    txt(g, '↓ 桜ヶ丘神社・自転車店・ラーメン', X(0) + 90, my0 + mh - 16, 15, F.sans, '#6a4a3c', 700);
    g.restore();
    g.strokeStyle = '#8a8478'; g.lineWidth = 3; g.strokeRect(mx0, my0, mw, mh);
    // north arrow
    const nx = mx0 + mw - 44, ny = my0 + 52;
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(nx, ny, 30, 0, 7); g.fill();
    g.fillStyle = '#33507a'; g.beginPath(); g.moveTo(nx, ny - 24); g.lineTo(nx + 11, ny + 12); g.lineTo(nx, ny + 5); g.lineTo(nx - 11, ny + 12); g.closePath(); g.fill();
    txt(g, 'N', nx, ny + 21, 14, F.en, '#33507a', 900);
    // scale
    g.fillStyle = '#4a4453'; g.fillRect(mx0 + 20, my0 + mh - 58, 50 * 3.9, 5);
    txt(g, '0', mx0 + 20, my0 + mh - 72, 13, F.en, '#4a4453', 700); txt(g, '50m', mx0 + 20 + 50 * 3.9, my0 + mh - 72, 13, F.en, '#4a4453', 700);
    // legend
    const lx = 746; let ly = 116;
    rr(g, lx - 8, ly - 6, 270, 520, 10, '#f7f4ec', '#c9c1b0', 2);
    txt(g, '凡 例', lx + 127, ly + 22, 24, F.sans, '#33507a', 900); ly += 58;
    const row = (draw, label, en) => { draw(g, lx + 26, ly, 30); txt(g, label, lx + 58, ly - 5, 21, F.sans, '#3a3346', 900, 'left'); txt(g, en, lx + 58, ly + 16, 13, F.en, '#6a6470', 500, 'left'); ly += 56; };
    row((g2, x, y, s) => { g2.fillStyle = '#ef9fbe'; g2.fillRect(x - 17, y - 12, 34, 24); g2.strokeStyle = '#c96b8c'; g2.lineWidth = 2; g2.strokeRect(x - 17, y - 12, 34, 24); }, '駅', 'Station');
    row((g2, x, y, s) => busIcon(g2, x, y, s, '#ffffff', '#e0799c'), 'バスのりば', 'Bus Stop');
    row((g2, x, y, s) => taxiIcon(g2, x, y, s, '#ffffff', '#33507a'), 'タクシーのりば', 'Taxi');
    row((g2, x, y, s) => pIcon(g2, x, y, s * 0.9), '駐輪場', 'Bicycle Parking');
    row((g2, x, y, s) => postIcon(g2, x, y, s * 0.9), '郵便ポスト', 'Post Box');
    row((g2, x, y, s) => telIcon(g2, x, y, s * 0.9), '公衆電話', 'Public Phone');
    row((g2, x, y, s) => wcIcon(g2, x, y, s * 0.9), 'トイレ（駅構内）', 'Toilet');
    row((g2, x, y, s) => T.sakuraIcon(g2, x, y, 14), '桜の名所', 'Cherry Blossoms');
    rr(g, lx - 8, 652, 270, 96, 10, '#33507a');
    txt(g, '← 花見台  3分', lx + 127, 680, 20, F.sans, '#f3f1ea', 700);
    txt(g, '春日野  4分 →', lx + 127, 712, 20, F.sans, '#f3f1ea', 700);
    txt(g, '桜ヶ丘町', lx + 127, 738, 13, F.sans, '#cfdcef', 500);
  }, { key: 'plaza-map' });

  // =============================================================== back of the map board: plaza guide
  S.plazaGuide = tex.draw(512, 384, (g, W, H) => {
    g.fillStyle = '#eeeadf'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#33507a'; g.fillRect(0, 0, W, 70);
    txt(g, '駅前広場のご案内', W / 2, 38, 36, F.sans, '#f3f1ea', 900);
    const items = [['#d9463b', '広場内では自転車を降りて', '押して歩きましょう'], ['#3f8f5b', 'ごみは分別して', 'ごみ箱へ入れてください'], ['#e0799c', '花壇の花や桜の木を', '大切にしましょう'], ['#8a8478', '路上喫煙禁止区域', 'No smoking on the street']];
    let y = 104;
    for (const [c, a, b] of items) {
      g.fillStyle = c; g.beginPath(); g.arc(46, y + 12, 20, 0, 7); g.fill();
      g.fillStyle = '#f7f3ea'; g.beginPath(); g.arc(46, y + 12, 9, 0, 7); g.fill();
      txt(g, a, 82, y, 25, F.sans, '#3a3346', 900, 'left'); txt(g, b, 82, y + 28, 20, F.sans, '#5a5460', 500, 'left');
      y += 66;
    }
    txt(g, '桜ヶ丘町 ・ 桜ヶ丘駅前商店会', W / 2, H - 16, 16, F.sans, '#6a6470', 700);
  }, { key: 'plaza-guide' });

  // =============================================================== 桜ヶ丘 観光案内 (tourist board)
  S.tourist = tex.draw(1024, 768, (g, W, H) => {
    g.fillStyle = '#f3ead8'; g.fillRect(0, 0, W, H);
    const r = ctx.rng('tour');
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(200,170,130,${r.range(0.03, 0.07)})`; g.beginPath(); g.arc(r() * W, r() * H, r.range(20, 90), 0, 7); g.fill(); }
    // title
    for (let i = 0; i < 7; i++) T.sakuraIcon(g, 40 + i * 20 + r.range(-8, 8), 30 + r.range(-12, 18), r.range(8, 13), '#f2b5c8', '#dd7f9d');
    txt(g, '桜ヶ丘 観光案内', W / 2, 62, 70, F.brush, '#4a3438', 400);
    txt(g, 'Sakuragaoka Sightseeing Guide', W / 2, 114, 22, F.en, '#8a6a60', 500);
    for (let i = 0; i < 7; i++) T.sakuraIcon(g, W - 40 - i * 20 + r.range(-8, 8), 34 + r.range(-12, 18), r.range(8, 13), '#f2b5c8', '#dd7f9d');
    g.strokeStyle = '#c9a98a'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 136); g.lineTo(W - 40, 136); g.stroke();
    // hand-drawn map (left)
    const mx = 36, my = 156, mw = 440, mh = 480;
    rr(g, mx, my, mw, mh, 16, '#f7f1e2', '#c9a98a', 3);
    g.save(); tex.roundRect(g, mx, my, mw, mh, 16); g.clip();
    g.fillStyle = '#bcdcea'; g.beginPath(); g.moveTo(mx, my + 40); g.bezierCurveTo(mx + 150, my + 70, mx + 300, my + 20, mx + mw, my + 60); g.lineTo(mx + mw, my + 110); g.bezierCurveTo(mx + 300, my + 70, mx + 150, my + 120, mx, my + 92); g.closePath(); g.fill();
    txt(g, '桜川', mx + 70, my + 72, 24, F.hand, '#3c6f96', 400);
    g.fillStyle = '#d5e8c0'; g.beginPath(); g.moveTo(mx, my + 96); g.bezierCurveTo(mx + 150, my + 124, mx + 300, my + 74, mx + mw, my + 114); g.lineTo(mx + mw, my + 150); g.bezierCurveTo(mx + 300, my + 110, mx + 150, my + 160, mx, my + 132); g.closePath(); g.fill();
    for (let i = 0; i < 16; i++) { const x = mx + 12 + i * 28, y = my + 118 + Math.sin(i * 0.7) * 10 - (i > 8 ? 12 : 0); g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.fillStyle = '#eb9db6'; g.beginPath(); g.arc(x + 4, y + 3, 6, 0, 7); g.fill(); }
    g.strokeStyle = '#6a6470'; g.lineWidth = 6; g.beginPath(); g.moveTo(mx, my + 250); g.lineTo(mx + mw, my + 236); g.stroke();
    g.strokeStyle = '#ef9fbe'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx, my + 250); g.lineTo(mx + mw, my + 236); g.stroke();
    for (let i = 0; i < 8; i++) { const x = mx + 30 + i * 22; g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(x, my + 222 - i * 0.6, 9, 0, 7); g.fill(); }
    rr(g, mx + 200, my + 254, 80, 40, 6, '#ef9fbe', '#c96b8c', 2); txt(g, '桜ヶ丘駅', mx + 240, my + 275, 17, F.sans, '#3a3346', 900);
    g.fillStyle = '#ffffff'; g.fillRect(mx + 226, my + 300, 26, mh); g.fillRect(mx, my + 318, mw, 18);
    g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(mx + 190, my + 312, 20, 0, 7); g.fill();
    toriiIcon(g, mx + 330, my + 420, 34); txt(g, '桜ヶ丘神社', mx + 330, my + 456, 17, F.sans, '#6a4a3c', 900);
    g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(mx + 380, my + 404, 18, 0, 7); g.fill();
    const mark = (n, x, y) => { g.fillStyle = '#d9718f'; g.beginPath(); g.arc(x, y, 17, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); txt(g, String(n), x, y + 1, 21, F.sans, '#ffffff', 900); };
    mark(1, mx + 176, my + 342); mark(2, mx + 300, my + 158); mark(3, mx + 402, my + 380); mark(4, mx + 100, my + 205);
    txt(g, '現在地', mx + 262, my + 372, 18, F.sans, '#d9463b', 900);
    g.fillStyle = '#d9463b'; g.beginPath(); g.arc(mx + 236, my + 352, 7, 0, 7); g.fill();
    g.restore();
    // spots (right)
    const spots = [
      ['駅前の大桜', '樹齢およそ八十年のソメイヨシノ。', '丸いベンチでひと休みできます。'],
      ['桜川堤の桜並木', '約1.2kmつづく桜のトンネル。', '堤防の上は散歩道です。'],
      ['桜ヶ丘神社のしだれ桜', '境内の枝垂れ桜は町の自慢。', '夕方は灯籠に灯りがともります。'],
      ['線路沿いの桜', '電車と桜をいっしょに撮れる', '人気の撮影スポットです。'],
    ];
    let y = 160;
    spots.forEach(([t, a, b], i) => {
      rr(g, 500, y, 490, 112, 12, 'rgba(255,255,255,0.55)', '#e2cdb6', 2);
      g.fillStyle = '#f7d3de'; g.beginPath(); g.arc(556, y + 56, 38, 0, 7); g.fill();
      g.fillStyle = '#8a6446'; g.fillRect(552, y + 64, 8, 28);
      g.fillStyle = '#f2b5c8'; g.beginPath(); g.arc(556, y + 50, 26, 0, 7); g.fill(); g.fillStyle = '#eb9db6'; g.beginPath(); g.arc(566, y + 56, 14, 0, 7); g.fill();
      g.fillStyle = '#d9718f'; g.beginPath(); g.arc(608, y + 30, 16, 0, 7); g.fill(); txt(g, String(i + 1), 608, y + 31, 20, F.sans, '#fff', 900);
      txt(g, t, 632, y + 30, 30, F.sans, '#4a3438', 900, 'left', 'middle', 350);
      txt(g, a, 610, y + 66, 21, F.sans, '#5a4a48', 500, 'left', 'middle', 372);
      txt(g, b, 610, y + 93, 21, F.sans, '#5a4a48', 500, 'left', 'middle', 372);
      y += 122;
    });
    rr(g, 36, 652, 954, 92, 14, '#e8a6bb');
    txt(g, '見頃  3月下旬〜4月上旬', 270, 684, 28, F.sans, '#ffffff', 900);
    txt(g, '桜ヶ丘 春まつり  4月6日(土)・7日(日)', 700, 684, 28, F.sans, '#ffffff', 900);
    txt(g, '桜ヶ丘町観光協会 ・ 桜川電鉄', W / 2, 724, 20, F.sans, '#fff4f7', 700);
  }, { key: 'plaza-tourist' });

  // =============================================================== community notice board face + header
  S.notice = tex.draw(1024, 640, (g, W, H) => {
    const r = ctx.rng('notice');
    g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${r.chance(0.5) ? '150,130,100' : '255,250,240'},${r.range(0.05, 0.12)})`; g.fillRect(r() * W, r() * H, 2, 2); }
    // old tape marks / pin holes
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(220,210,170,0.6)'; g.save(); g.translate(r() * W, r() * H); g.rotate(r.range(-0.5, 0.5)); g.fillRect(-18, -6, 36, 12); g.restore(); }
    const pin = (x, y, c) => { g.fillStyle = 'rgba(60,50,60,0.25)'; g.beginPath(); g.arc(x + 2, y + 3, 7, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 2, y - 2, 2.5, 0, 7); g.fill(); };
    const poster = (x, y, w, h, rot, bg, draw, pins = '#d9463b') => {
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
      g.fillStyle = 'rgba(70,60,60,0.18)'; g.fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
      g.fillStyle = bg; g.fillRect(-w / 2, -h / 2, w, h);
      g.save(); g.translate(-w / 2, -h / 2); draw(w, h); g.restore();
      pin(-w / 2 + 12, -h / 2 + 12, pins); pin(w / 2 - 12, -h / 2 + 12, pins);
      g.restore();
    };
    // 1: spring festival
    poster(26, 26, 300, 420, -0.02, '#fbe3ea', (w, h) => {
      g.fillStyle = '#ef9fbe'; g.fillRect(0, 0, w, 96);
      for (let i = 0; i < 6; i++) { const x = 26 + i * 50; g.strokeStyle = '#7a4a40'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 25, 18); g.lineTo(x + 25, 18); g.stroke(); rr(g, x - 14, 22, 28, 38, 12, '#d9463b'); g.fillStyle = '#f7d36a'; g.fillRect(x - 10, 38, 20, 4); }
      txt(g, '第三十八回', w / 2, 76, 22, F.sans, '#fff', 900);
      txt(g, '桜ヶ丘', w / 2, 140, 52, F.brush, '#c24a6e', 400);
      txt(g, '春まつり', w / 2, 204, 64, F.brush, '#c24a6e', 400);
      for (let i = 0; i < 9; i++) T.sakuraIcon(g, 20 + r() * (w - 40), 240 + r() * 30, r.range(7, 12));
      txt(g, '4月6日(土)・7日(日)', w / 2, 292, 28, F.sans, '#4a3438', 900);
      txt(g, '午前10時〜午後4時', w / 2, 326, 20, F.sans, '#4a3438', 700);
      txt(g, '会場  駅前広場・桜川堤', w / 2, 358, 20, F.sans, '#4a3438', 700);
      txt(g, '模擬店・和太鼓・野点・スタンプラリー', w / 2, 388, 15, F.sans, '#7a5a58', 700, 'center', 'middle', w - 20);
      txt(g, '主催  桜ヶ丘町内会', w / 2, 410, 14, F.sans, '#7a5a58', 500);
    });
    // 2: lost cat
    poster(354, 34, 236, 300, 0.035, '#f6f4ee', (w, h) => {
      g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, 54);
      txt(g, '迷い猫を', w / 2, 20, 22, F.sans, '#fff', 900); txt(g, '探しています', w / 2, 42, 20, F.sans, '#fff', 900);
      // calico cat face
      const cx = w / 2, cy = 124;
      g.fillStyle = '#fbf8f2'; g.strokeStyle = '#4a4050'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx - 44, cy - 20); g.lineTo(cx - 38, cy - 60); g.lineTo(cx - 12, cy - 38); g.lineTo(cx + 12, cy - 38); g.lineTo(cx + 38, cy - 60); g.lineTo(cx + 44, cy - 20);
      g.quadraticCurveTo(cx + 54, cy + 30, cx, cy + 40); g.quadraticCurveTo(cx - 54, cy + 30, cx - 44, cy - 20); g.closePath(); g.fill();
      g.save(); g.clip(); g.fillStyle = '#e9a24e'; g.beginPath(); g.arc(cx - 34, cy - 30, 30, 0, 7); g.fill(); g.fillStyle = '#4a4050'; g.beginPath(); g.arc(cx + 36, cy - 34, 26, 0, 7); g.fill(); g.restore();
      g.beginPath(); g.moveTo(cx - 44, cy - 20); g.lineTo(cx - 38, cy - 60); g.lineTo(cx - 12, cy - 38); g.lineTo(cx + 12, cy - 38); g.lineTo(cx + 38, cy - 60); g.lineTo(cx + 44, cy - 20); g.quadraticCurveTo(cx + 54, cy + 30, cx, cy + 40); g.quadraticCurveTo(cx - 54, cy + 30, cx - 44, cy - 20); g.closePath(); g.stroke();
      g.fillStyle = '#4a4050'; g.beginPath(); g.ellipse(cx - 18, cy - 4, 5, 8, 0, 0, 7); g.ellipse(cx + 18, cy - 4, 5, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#e57f8f'; g.beginPath(); g.moveTo(cx - 5, cy + 10); g.lineTo(cx + 5, cy + 10); g.lineTo(cx, cy + 16); g.fill();
      g.strokeStyle = '#4a4050'; g.lineWidth = 1.5; for (const s of [-1, 1]) for (const d of [-4, 4]) { g.beginPath(); g.moveTo(cx + s * 14, cy + 16 + d * 0.4); g.lineTo(cx + s * 50, cy + 12 + d * 2); g.stroke(); }
      g.fillStyle = '#d9463b'; g.fillRect(cx - 30, cy + 34, 60, 7); g.fillStyle = '#f2c230'; g.beginPath(); g.arc(cx, cy + 44, 6, 0, 7); g.fill();
      txt(g, '三毛猫（メス）', w / 2, 196, 20, F.sans, '#3a3346', 900);
      txt(g, '名前：こはる  3さい', w / 2, 222, 17, F.sans, '#3a3346', 700);
      txt(g, '赤い首輪に鈴をつけています', w / 2, 246, 14, F.sans, '#3a3346', 500, 'center', 'middle', w - 16);
      txt(g, 'お心当たりの方は', w / 2, 270, 14, F.sans, '#5a5460', 500);
      txt(g, '桜ヶ丘三丁目  田中まで', w / 2, 290, 15, F.sans, '#3a3346', 900);
    }, '#2f64b5');
    // 3: calligraphy class
    poster(620, 26, 196, 290, -0.03, '#f6f0df', (w, h) => {
      g.strokeStyle = '#b44'; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
      txt(g, '書', w / 2, 84, 110, F.brush, '#2f2a33', 400);
      g.fillStyle = '#c0392b'; g.fillRect(w - 44, 120, 26, 26); txt(g, '習', w - 31, 134, 18, F.serif, '#fff', 700);
      txt(g, '書道教室', w / 2, 172, 34, F.serif, '#2f2a33', 700);
      txt(g, '生徒募集中', w / 2, 206, 22, F.serif, '#b03a2e', 700);
      txt(g, '毎週水曜 午後4時〜', w / 2, 238, 16, F.sans, '#3a3346', 700);
      txt(g, '桜ヶ丘公民館 二階', w / 2, 260, 15, F.sans, '#3a3346', 500);
      txt(g, '子どもから大人まで', w / 2, 280, 13, F.sans, '#5a5460', 500);
    }, '#3f8f5b');
    // 4: garbage chart
    poster(352, 362, 452, 252, 0.012, '#f7f7f2', (w, h) => {
      g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, 50);
      txt(g, 'ごみ収集日のお知らせ', w / 2, 26, 28, F.sans, '#fff', 900);
      const rows = [['月', 'もやすごみ', '#d9463b'], ['火', 'プラスチック', '#e9a23b'], ['水', 'びん・かん・ペットボトル', '#2f64b5'], ['木', 'もやすごみ', '#d9463b'], ['金', '古紙・布（第2・第4）', '#6a9a4a'], ['土・日', '収集はありません', '#8a8478']];
      rows.forEach(([d, t, c], i) => {
        const y = 60 + i * 28;
        g.fillStyle = i % 2 ? '#eef0ea' : '#f7f7f2'; g.fillRect(6, y, w - 12, 28);
        rr(g, 12, y + 3, 70, 22, 5, c); txt(g, d, 47, y + 15, 17, F.sans, '#fff', 900);
        txt(g, t, 96, y + 15, 19, F.sans, '#3a3346', 700, 'left');
      });
      txt(g, '朝8時30分までに、決められた場所へ出しましょう。  桜ヶ丘町内会 環境部', w / 2, h - 14, 13, F.sans, '#5a5460', 500, 'center', 'middle', w - 20);
    }, '#e9a23b');
    // 5: last summer's faded festival poster
    poster(838, 44, 164, 250, 0.05, '#e6e4dc', (w, h) => {
      g.fillStyle = 'rgba(120,150,190,0.45)'; g.fillRect(0, 0, w, h * 0.55);
      txt(g, '夏祭り', w / 2, 60, 40, F.brush, 'rgba(60,70,110,0.5)', 400);
      txt(g, '盆踊り大会', w / 2, 110, 24, F.brush, 'rgba(60,70,110,0.45)', 400);
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(230,180,90,0.45)'; g.beginPath(); g.arc(20 + i * 30, 150, 10, 0, 7); g.fill(); }
      txt(g, '8月17日（土）', w / 2, 190, 18, F.sans, 'rgba(60,60,70,0.4)', 700);
      txt(g, '桜ヶ丘公園', w / 2, 214, 15, F.sans, 'rgba(60,60,70,0.35)', 700);
      g.fillStyle = '#e4dcc6'; g.beginPath(); g.moveTo(w, h - 40); g.lineTo(w, h); g.lineTo(w - 50, h); g.closePath(); g.fill();
    }, '#8a8478');
    // 6: disaster drill
    poster(832, 330, 170, 150, -0.02, '#fff7d6', (w, h) => {
      g.fillStyle = '#e9a23b'; g.fillRect(0, 0, w, 36);
      txt(g, '防災訓練', w / 2, 19, 22, F.sans, '#fff', 900);
      txt(g, '5月19日（日）', w / 2, 60, 17, F.sans, '#3a3346', 900);
      txt(g, '午前9時  駅前広場集合', w / 2, 86, 13, F.sans, '#3a3346', 700);
      txt(g, '消火器・AEDの体験', w / 2, 108, 13, F.sans, '#3a3346', 500);
      txt(g, 'ご家族でご参加ください', w / 2, 130, 12, F.sans, '#5a5460', 500);
    }, '#2f64b5');
    // 7: local mascot sticker
    g.save(); g.translate(900, 560); g.rotate(-0.2);
    g.fillStyle = '#fbe9ef'; g.beginPath(); g.arc(0, 0, 48, 0, 7); g.fill(); g.strokeStyle = '#eb9db6'; g.lineWidth = 5; g.stroke();
    T.sakuraIcon(g, 0, -40, 16, '#f2b5c8', '#dd7f9d');
    g.fillStyle = '#3a3346'; g.beginPath(); g.arc(-14, -2, 5, 0, 7); g.arc(14, -2, 5, 0, 7); g.fill();
    g.fillStyle = '#f2a0b0'; g.beginPath(); g.arc(-24, 10, 6, 0, 7); g.arc(24, 10, 6, 0, 7); g.fill();
    g.strokeStyle = '#3a3346'; g.lineWidth = 3; g.beginPath(); g.arc(0, 6, 8, 0.2, Math.PI - 0.2); g.stroke();
    txt(g, 'さくらまる', 0, 34, 14, F.round, '#c24a6e', 900);
    g.restore();
  }, { key: 'plaza-notice' });
  S.noticeHeader = tex.draw(512, 80, (g, W, H) => {
    g.fillStyle = '#6b4c38'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(40,25,20,0.3)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 8 + i * 13); g.bezierCurveTo(W * 0.3, 4 + i * 13, W * 0.6, 14 + i * 13, W, 8 + i * 13); g.stroke(); }
    txt(g, '桜ヶ丘町内会  掲示板', W / 2, H / 2 + 2, 44, F.serif, '#f1e6cf', 700);
  }, { key: 'plaza-notice-hdr' });

  // =============================================================== bus stop
  S.busRound = tex.draw(256, 256, (g, W, H) => {
    g.fillStyle = '#e78fae'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f3f1ec'; g.beginPath(); g.arc(W / 2, H / 2, 104, 0, 7); g.fill();
    txt(g, '桜川バス', W / 2, 62, 24, F.sans, '#d9718f', 900);
    txt(g, '桜ヶ丘駅前', W / 2, 122, 40, F.sans, '#2f3a58', 900, 'center', 'middle', 190);
    txt(g, 'さくらがおかえきまえ', W / 2, 160, 17, F.sans, '#2f3a58', 700);
    txt(g, 'Sakuragaoka Sta.', W / 2, 188, 15, F.en, '#6a6470', 500);
  }, { key: 'plaza-busround' });
  S.busTable = tex.draw(256, 448, (g, W, H) => {
    const r = ctx.rng('bustable');
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e78fae'; g.fillRect(0, 0, W, 58);
    txt(g, '桜ヶ丘駅前  時刻表', W / 2, 20, 21, F.sans, '#fff', 900);
    txt(g, '桜01  市民病院・花見台駅 行', W / 2, 44, 14, F.sans, '#fff', 700);
    g.fillStyle = '#d9d6ce'; g.fillRect(0, 58, W, 22);
    txt(g, '時', 20, 69, 13, F.sans, '#3a3346', 900); txt(g, '平 日', 96, 69, 13, F.sans, '#3a3346', 900); txt(g, '土・休日', 198, 69, 13, F.sans, '#c24a6e', 900);
    for (let hr = 6; hr <= 21; hr++) {
      const y = 80 + (hr - 6) * 22;
      g.fillStyle = hr % 2 ? '#f2f0ea' : '#e8e6de'; g.fillRect(0, y, W, 22);
      txt(g, String(hr), 20, y + 11, 14, F.en, '#3a3346', 900);
      const n = hr >= 7 && hr <= 9 ? 4 : hr >= 16 && hr <= 19 ? 3 : 2;
      const wk = []; for (let i = 0; i < n; i++) wk.push(String(Math.floor((i + r.range(0.1, 0.8)) * 60 / n)).padStart(2, '0'));
      const we = []; for (let i = 0; i < Math.max(1, n - 1); i++) we.push(String(Math.floor((i + r.range(0.1, 0.8)) * 60 / Math.max(1, n - 1))).padStart(2, '0'));
      txt(g, wk.join(' '), 96, y + 11, 14, F.en, '#3a3346', 700);
      txt(g, we.join(' '), 198, y + 11, 14, F.en, '#c24a6e', 700);
    }
    g.strokeStyle = '#bdb8ad'; g.lineWidth = 1; g.beginPath(); g.moveTo(40, 58); g.lineTo(40, 432); g.moveTo(150, 58); g.lineTo(150, 432); g.stroke();
    txt(g, '桜川バス株式会社  営業所 桜ヶ丘', W / 2, 438, 11, F.sans, '#6a6470', 500);
  }, { key: 'plaza-bustable' });
  S.shelterFascia = tex.draw(1024, 96, (g, W, H) => {
    g.fillStyle = '#f1ede4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e78fae'; g.fillRect(0, H - 12, W, 12);
    busIcon(g, 56, 44, 50, '#ffffff', '#e0799c');
    txt(g, '桜ヶ丘駅前', 110, 46, 50, F.sans, '#2f3a58', 900, 'left');
    txt(g, 'バス停', 400, 50, 34, F.sans, '#2f3a58', 700, 'left');
    txt(g, 'Sakuragaoka Sta. Bus Stop', 530, 54, 22, F.en, '#6a6470', 500, 'left');
    rr(g, 852, 18, 150, 52, 26, '#e78fae'); txt(g, '桜川バス', 927, 45, 26, F.sans, '#fff', 900);
  }, { key: 'plaza-shelter-fascia' });
  S.shelterAd = tex.draw(256, 512, (g, W, H) => {
    const r = ctx.rng('ad');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9cc4ea'); gr.addColorStop(0.55, '#e4eef5'); gr.addColorStop(1, '#fbe9ef');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 36; i++) { g.fillStyle = r.chance(0.5) ? '#f2b5c8' : '#f7d3de'; g.beginPath(); g.arc(r() * W, 250 + r() * 110 - (r() * 40), r.range(14, 30), 0, 7); g.fill(); }
    g.fillStyle = '#8a6446'; for (let i = 0; i < 5; i++) g.fillRect(20 + i * 52, 320, 6, 60);
    rr(g, 30, 372, 196, 44, 16, '#f5f0e6', '#8e959d', 2); g.fillStyle = '#ef9fbe'; g.fillRect(30, 396, 196, 7);
    g.fillStyle = '#6d8fb0'; for (let i = 0; i < 6; i++) g.fillRect(44 + i * 30, 380, 20, 12);
    txt(g, '春、', 60, 70, 44, F.brush, '#3a3346', 400);
    txt(g, '桜川線で', 128, 128, 44, F.brush, '#3a3346', 400);
    txt(g, 'いこう。', 150, 184, 44, F.brush, '#3a3346', 400);
    txt(g, '沿線 さくらめぐり', W / 2, 440, 22, F.sans, '#c24a6e', 900);
    txt(g, '桜川電鉄', W / 2, 486, 20, F.sans, '#3a3346', 900);
  }, { key: 'plaza-shelter-ad' });
  S.routeMap = tex.draw(512, 224, (g, W, H) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2f3a58'; g.fillRect(0, 0, W, 40);
    txt(g, '桜川バス  路線図', 20, 21, 22, F.sans, '#fff', 900, 'left'); txt(g, 'Route Map', W - 16, 22, 15, F.en, '#cfdcef', 500, 'right');
    const lines = [['#e78fae', '桜01', ['桜ヶ丘駅前', '三丁目', '市民病院前', '花見台駅']], ['#5a9bd5', '桜02', ['桜ヶ丘駅前', '桜川堤', '運動公園', '桜川温泉']]];
    lines.forEach(([c, id, stops], i) => {
      const y = 92 + i * 80;
      rr(g, 14, y - 16, 60, 32, 8, c); txt(g, id, 44, y, 18, F.sans, '#fff', 900);
      g.fillStyle = c; g.fillRect(96, y - 4, 390, 8);
      stops.forEach((s, k) => { const x = 104 + k * 124; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.strokeStyle = c; g.lineWidth = 4; g.stroke(); txt(g, s, x, y + 28, 15, F.sans, '#3a3346', k === 0 ? 900 : 700); });
    });
  }, { key: 'plaza-routemap' });

  // =============================================================== taxi
  S.taxi = tex.draw(256, 320, (g, W, H) => {
    g.fillStyle = '#2f4a78'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#f3f1ea'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
    taxiIcon(g, W / 2, 86, 120, '#f3f1ea', null);
    txt(g, 'タクシー', W / 2, 176, 50, F.sans, '#f3f1ea', 900);
    txt(g, 'のりば', W / 2, 232, 44, F.sans, '#f3f1ea', 900);
    txt(g, 'TAXI', W / 2, 282, 34, F.en, '#f2c230', 900);
  }, { key: 'plaza-taxi' });

  // =============================================================== bicycle parking
  S.bikeSign = tex.draw(512, 144, (g, W, H) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
    rr(g, 12, 12, 120, 120, 14, '#2f64b5'); bikeIcon(g, 72, 76, 100, '#f3f1ea');
    txt(g, '駐輪場', 316, 62, 66, F.sans, '#2f3a58', 900);
    txt(g, 'Bicycle Parking  ・  桜ヶ丘駅前', 316, 116, 20, F.en, '#5a5460', 700, 'center', 'middle', 350);
  }, { key: 'plaza-bikesign' });
  S.bikeNotice = tex.draw(256, 320, (g, W, H) => {
    g.fillStyle = '#f5f3ec'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d9463b'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#d9463b'; g.fillRect(8, 8, W - 16, 78);
    txt(g, '放置自転車', W / 2, 36, 38, F.sans, '#fff', 900);
    txt(g, '禁止', W / 2, 72, 30, F.sans, '#fff', 900);
    g.save(); g.translate(W / 2, 140); bikeIcon(g, 0, 0, 80, '#3a3346'); g.strokeStyle = '#d9463b'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.moveTo(-28, -28); g.lineTo(28, 28); g.stroke(); g.restore();
    txt(g, 'ここに自転車を', W / 2, 206, 20, F.sans, '#3a3346', 900);
    txt(g, '放置しないでください', W / 2, 232, 20, F.sans, '#3a3346', 900);
    txt(g, '放置自転車は撤去します', W / 2, 262, 15, F.sans, '#d9463b', 700);
    txt(g, '桜ヶ丘町', W / 2, 290, 16, F.sans, '#3a3346', 700);
  }, { key: 'plaza-bikenotice' });
  S.slotNums = tex.draw(512, 64, (g, W, H) => {
    g.fillStyle = '#e9e7e0'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { const x = i * W / 12; g.strokeStyle = '#9aa1a8'; g.lineWidth = 2; g.strokeRect(x + 2, 2, W / 12 - 4, H - 4); txt(g, String(i + 1), x + W / 24, H / 2 + 2, 30, F.en, '#2f3a58', 900); }
  }, { key: 'plaza-slotnums' });

  // =============================================================== monument
  S.monument = tex.draw(512, 176, (g, W, H) => {
    g.fillStyle = '#44414b'; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,0.1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.06)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(210,200,180,0.5)'; g.lineWidth = 2; g.strokeRect(9, 9, W - 18, H - 18);
    txt(g, '桜ヶ丘駅開業九十周年', W / 2, 70, 50, F.brush, '#ddd3bd', 400, 'center', 'middle', W - 50);
    txt(g, '〜 桜とともに九十年 〜', W / 2, 132, 26, F.brush, '#cfc5ae', 400, 'center', 'middle', W - 80);
  }, { key: 'plaza-monument' });
  S.monumentPlate = tex.draw(256, 112, (g, W, H) => {
    g.fillStyle = '#b8a27a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#8a7450'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
    txt(g, '昭和十年四月一日 開業', W / 2, 30, 20, F.serif, '#4a3a2a', 700);
    txt(g, '令和七年四月吉日', W / 2, 60, 18, F.serif, '#4a3a2a', 700);
    txt(g, '桜ヶ丘町 ・ 桜川電鉄', W / 2, 88, 17, F.serif, '#4a3a2a', 700);
  }, { key: 'plaza-monument-plate' });

  // =============================================================== postbox
  S.postFront = tex.draw(128, 160, (g, W, H) => {
    g.fillStyle = '#c9443a'; g.fillRect(0, 0, W, H);
    txt(g, '〒', W / 2, 44, 60, F.sans, '#f4ede2', 900);
    txt(g, '郵便', W / 2, 108, 34, F.serif, '#f4ede2', 700);
    txt(g, 'POST', W / 2, 142, 18, F.en, '#f4ede2', 700);
  }, { key: 'plaza-postfront' });
  S.postTimes = tex.draw(128, 96, (g, W, H) => {
    g.fillStyle = '#f1efe8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c9443a'; g.fillRect(0, 0, W, 22);
    txt(g, '取集時刻', W / 2, 12, 15, F.sans, '#fff', 900);
    txt(g, '平日  10:30  15:00', W / 2, 40, 13, F.sans, '#3a3346', 700);
    txt(g, '17:40', W / 2 + 22, 58, 13, F.sans, '#3a3346', 700);
    txt(g, '土休日  11:00', W / 2, 78, 13, F.sans, '#3a3346', 700);
  }, { key: 'plaza-posttimes' });

  // =============================================================== phone booth
  S.phoneSign = tex.draw(256, 64, (g, W, H) => {
    g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, W, H);
    txt(g, '☎', 34, 34, 40, F.sans, '#f4f4ee', 700);
    txt(g, '公衆電話', 150, 34, 38, F.sans, '#f4f4ee', 900);
  }, { key: 'plaza-phonesign' });
  S.phoneBook = tex.draw(128, 96, (g, W, H) => {
    g.fillStyle = '#e8c547'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2f64b5'; g.fillRect(0, H - 22, W, 22);
    txt(g, '電話帳', W / 2, 30, 26, F.sans, '#2f3a58', 900);
    txt(g, '桜ヶ丘地区', W / 2, 60, 16, F.sans, '#2f3a58', 700);
  }, { key: 'plaza-phonebook' });
  S.phoneNotice = tex.draw(128, 128, (g, W, H) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
    txt(g, '緊急通報', W / 2, 18, 18, F.sans, '#d9463b', 900);
    txt(g, '110  警察', W / 2, 48, 18, F.en, '#3a3346', 900);
    txt(g, '119  消防・救急', W / 2, 74, 15, F.sans, '#3a3346', 900);
    txt(g, '通話は無料です', W / 2, 104, 13, F.sans, '#5a5460', 700);
  }, { key: 'plaza-phonenotice' });

  // =============================================================== sorted bins
  const binLabel = (key, bg, line1, line2) => tex.draw(128, 128, (g, W, H) => {
    g.fillStyle = '#f1efe8'; g.fillRect(0, 0, W, H);
    g.fillStyle = bg; g.fillRect(0, 0, W, 60);
    txt(g, line1, W / 2, 31, 26, F.sans, '#fff', 900, 'center', 'middle', W - 10);
    txt(g, line2, W / 2, 94, 17, F.sans, '#3a3346', 700, 'center', 'middle', W - 12);
  }, { key: 'plaza-bin-' + key });
  S.binBurn = binLabel('burn', '#d9463b', 'もえるごみ', '紙くず・その他');
  S.binCan = binLabel('can', '#2f64b5', 'かん・びん', 'Cans / Bottles');
  S.binPet = binLabel('pet', '#3f8f5b', 'ペットボトル', 'PET Bottles');

  // =============================================================== clock dial
  S.clock = tex.draw(256, 256, (g, W, H) => {
    g.fillStyle = '#4b4d52'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f1ede3'; g.beginPath(); g.arc(W / 2, H / 2, 120, 0, 7); g.fill();
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
      g.strokeStyle = '#3a3346'; g.lineWidth = big ? 5 : 2;
      g.beginPath(); g.moveTo(W / 2 + Math.sin(a) * (big ? 96 : 104), H / 2 - Math.cos(a) * (big ? 96 : 104)); g.lineTo(W / 2 + Math.sin(a) * 112, H / 2 - Math.cos(a) * 112); g.stroke();
    }
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; txt(g, String(i), W / 2 + Math.sin(a) * 78, H / 2 - Math.cos(a) * 78 + 2, 24, F.en, '#3a3346', 700); }
    T.sakuraIcon(g, W / 2, H / 2 - 40, 12);
    txt(g, 'SAKURAGAOKA', W / 2, H / 2 + 44, 13, F.en, '#6a6470', 700);
  }, { key: 'plaza-clock' });
  S.clockPlate = tex.draw(256, 64, (g, W, H) => {
    g.fillStyle = '#b8a27a'; g.fillRect(0, 0, W, H);
    txt(g, '寄贈  桜ヶ丘駅前商店会', W / 2, H / 2 + 1, 22, F.serif, '#3f3226', 700);
  }, { key: 'plaza-clockplate' });

  // =============================================================== manhole / drain
  S.manhole = tex.draw(256, 256, (g, W, H) => {
    g.fillStyle = '#6f6e70'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#86858a'; g.beginPath(); g.arc(W / 2, H / 2, 124, 0, 7); g.fill();
    g.strokeStyle = '#5d5c60'; g.lineWidth = 6; g.beginPath(); g.arc(W / 2, H / 2, 112, 0, 7); g.stroke();
    g.save(); g.translate(W / 2, H / 2);
    for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 2 / 5); g.fillStyle = '#9b9aa0'; g.beginPath(); g.ellipse(0, -48, 22, 36, 0, 0, 7); g.fill(); g.strokeStyle = '#5d5c60'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = '#6f6e72'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.restore();
    g.fillStyle = '#5d5c60'; g.font = `900 17px ${F.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const s = 'さくらがおか・うすい・'; const n = [...s].length;
    [...s].forEach((ch, i) => { const a = -Math.PI / 2 + (i - n / 2 + 0.5) * 0.27; g.save(); g.translate(W / 2 + Math.cos(a) * 99, H / 2 + Math.sin(a) * 99); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); });
  }, { key: 'plaza-manhole' });
  S.grate = tex.draw(128, 128, (g, W, H) => {
    g.fillStyle = '#5f5e62'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#86858a'; g.fillRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#3f3e46'; for (let i = 0; i < 9; i++) g.fillRect(14 + i * 11.5, 14, 6, H - 28);
  }, { key: 'plaza-grate' });

  return S;
}
