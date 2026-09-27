// Scattered street props: V5 bench, gashapon row, 防災倉庫, 消火器 boxes, traffic cones + repair notice
// by a manhole on R4, and a ゴミ集積所 on the R4 rail-side strip.
import * as THREE from 'three';
import { rr, sakuraFlower, vtext, ftext } from './common.js';

let _tex = null;
function textures(ctx) {
  if (_tex && _tex.ctx === ctx) return _tex;
  const T = ctx.tex, F = T.FONTS;
  const t = { ctx };
  t.fire = T.draw(128, 208, (g, w, h) => {
    g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, 10);
    g.fillStyle = '#fbf6f0'; rr(g, 18, 16, w - 36, 150, 8); g.fill();
    vtext(g, '消火器', w / 2, 24, 44, F.sans, 900, 1.04, '#d9463b');
    ftext(g, 'FIRE EXTINGUISHER', w / 2, 184, w - 12, 11, F.en, 700, '#fbf6f0');
  }, { key: 'props.fire' });
  t.bench = T.draw(512, 64, (g, w, h) => {
    g.fillStyle = '#b8845a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.strokeStyle = `rgba(110,70,44,${0.1 + (i % 4) * 0.04})`; g.lineWidth = 1.5; g.beginPath(); const y = (i * 13) % h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 2, w * 0.7, y - 2, w, y + 1); g.stroke(); }
    ftext(g, '桜ヶ丘駅前商店街', w * 0.42, h / 2 + 3, w * 0.62, 40, F.round, 900, 'rgba(250,240,226,0.72)');
    sakuraFlower(g, w * 0.86, h / 2, 20, 'rgba(242,181,200,0.8)', 'rgba(250,240,226,0.8)');
  }, { key: 'props.bench.ad' });
  t.wood = T.draw(256, 64, (g, w, h) => {
    g.fillStyle = '#b8845a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(110,70,44,${0.1 + (i % 4) * 0.04})`; g.lineWidth = 1.5; g.beginPath(); const y = (i * 11) % h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 2, w * 0.7, y - 2, w, y + 1); g.stroke(); }
  }, { key: 'props.bench.wood' });
  const card = (key, draw) => T.draw(256, 160, draw, { key: 'props.gacha.' + key });
  t.cards = [
    card('neko', (g, w, h) => {
      g.fillStyle = '#fdf1e4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5c26b'; g.fillRect(0, 0, w, 34);
      ftext(g, 'ねこのおひるね', w / 2, 18, w * 0.9, 24, F.round, 900, '#6b4a3a');
      const cat = (x, y, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 26, 16, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x - 20, y - 8, 12, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(x - 30, y - 14); g.lineTo(x - 28, y - 26); g.lineTo(x - 20, y - 18); g.fill(); g.beginPath(); g.moveTo(x - 18, y - 18); g.lineTo(x - 12, y - 26); g.lineTo(x - 10, y - 14); g.fill(); };
      cat(70, 84, '#f2a65a'); cat(150, 92, '#f4f1ea'); cat(214, 80, '#6d6a80');
      ftext(g, 'マスコット 全5種', w / 2, 122, w * 0.9, 18, F.sans, 900, '#6b4a3a');
      g.fillStyle = '#e2465c'; rr(g, 70, 134, 116, 22, 6); g.fill(); ftext(g, '1回 200円', w / 2, 146, 110, 16, F.sans, 900, '#ffffff');
    }),
    card('train', (g, w, h) => {
      g.fillStyle = '#e8f3fb'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ef9fbe'; g.fillRect(0, 0, w, 34);
      ftext(g, '桜川線 ミニ電車', w / 2, 18, w * 0.9, 24, F.round, 900, '#ffffff');
      for (const [x, y] of [[20, 58], [132, 66]]) { g.fillStyle = '#f5f0e6'; rr(g, x, y, 104, 40, 12); g.fill(); g.fillStyle = '#ef9fbe'; g.fillRect(x, y + 24, 104, 6); g.fillStyle = '#9cc4ea'; for (let i = 0; i < 4; i++) rr(g, x + 10 + i * 23, y + 7, 16, 12, 3); g.fill(); g.fillStyle = '#4b4d55'; g.beginPath(); g.arc(x + 22, y + 42, 6, 0, Math.PI * 2); g.arc(x + 82, y + 42, 6, 0, Math.PI * 2); g.fill(); }
      ftext(g, 'コレクション 全6種', w / 2, 122, w * 0.9, 18, F.sans, 900, '#3a5a8a');
      g.fillStyle = '#2f6fc9'; rr(g, 70, 134, 116, 22, 6); g.fill(); ftext(g, '1回 300円', w / 2, 146, 110, 16, F.sans, 900, '#ffffff');
    }),
    card('wagashi', (g, w, h) => {
      g.fillStyle = '#fbf3ea'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9ad7a8'; g.fillRect(0, 0, w, 34);
      ftext(g, '和菓子ミニチュア', w / 2, 18, w * 0.9, 24, F.round, 900, '#2f6b3f');
      g.strokeStyle = '#8a6446'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 110); g.lineTo(80, 50); g.stroke();
      for (const [i, c] of [[0, '#f7c6d3'], [1, '#fbf6ee'], [2, '#a7d49a']]) { g.fillStyle = c; g.beginPath(); g.arc(50 + i * 13, 96 - i * 19, 12, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f2b5c8'; g.beginPath(); g.ellipse(150, 90, 34, 20, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7fae55'; g.beginPath(); g.ellipse(150, 76, 30, 10, 0.1, 0, Math.PI); g.fill();
      g.fillStyle = '#6b3a3a'; g.beginPath(); g.ellipse(214, 92, 22, 18, 0, 0, Math.PI * 2); g.fill();
      ftext(g, 'チャーム 全8種', w / 2, 122, w * 0.9, 18, F.sans, 900, '#2f6b3f');
      g.fillStyle = '#3f8a55'; rr(g, 70, 134, 116, 22, 6); g.fill(); ftext(g, '1回 200円', w / 2, 146, 110, 16, F.sans, 900, '#ffffff');
    }),
  ];
  t.gachaHead = T.draw(512, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fbe3ea'); gr.addColorStop(0.5, '#fdf6e0'); gr.addColorStop(1, '#e3f1fb'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const letters = 'カプセルトイ', cols = ['#e2465c', '#f09a3a', '#e8b93a', '#3f9a68', '#2f6fc9', '#9a5ac9'];
    g.font = `900 40px ${F.round}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...letters].forEach((ch, i) => { g.fillStyle = cols[i]; g.fillText(ch, 110 + i * 58, h / 2 + 3); });
    for (const [x, c] of [[40, '#f28b9b'], [472, '#7fc4e8']]) { g.fillStyle = c; g.beginPath(); g.arc(x, h / 2, 18, Math.PI, 0); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, h / 2, 18, 0, Math.PI); g.fill(); }
  }, { key: 'props.gacha.head' });
  t.price = T.draw(128, 48, (g, w, h) => { g.fillStyle = '#fbf8f2'; rr(g, 0, 0, w, h, 8); g.fill(); ftext(g, '硬貨を入れて まわしてね', w / 2, h / 2 + 1, w - 10, 13, F.round, 900, '#3a3346'); }, { key: 'props.gacha.price' });
  t.ribs = T.draw(128, 128, (g, w, h) => {
    g.fillStyle = '#c4c9cc'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(80,90,100,0.18)'; g.fillRect(x + 10, 0, 3, h); }
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(138,90,68,0)'); gr.addColorStop(1, 'rgba(138,90,68,0.22)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { key: 'props.cab.ribs' });
  t.cabLabel = T.draw(512, 128, (g, w, h) => {
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9463b'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    ftext(g, '防 災 倉 庫', w / 2, 56, w * 0.86, 70, F.sans, 900, '#d9463b');
    ftext(g, '桜ヶ丘町 自主防災会', w / 2, 104, w * 0.8, 22, F.sans, 700, '#3a3346');
  }, { key: 'props.cab.label' });
  t.cabList = T.draw(192, 160, (g, w, h) => {
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, 28);
    ftext(g, '保管品', w / 2, 15, w * 0.8, 18, F.sans, 900, '#ffffff');
    ['救急セット・担架', '毛布・簡易トイレ', '発電機・投光器', 'ヘルメット・かけや', '飲料水（5年保存）'].forEach((s, i) => ftext(g, '・' + s, 12, 44 + i * 24, w - 20, 14, F.sans, 700, '#3a3346', 'left'));
  }, { key: 'props.cab.list' });
  t.evac = T.draw(192, 256, (g, w, h) => {
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f8a57'; g.fillRect(0, 0, w, 150);
    // running figure (simplified pictogram)
    g.fillStyle = '#fbf8f2'; g.beginPath(); g.arc(122, 34, 14, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fbf8f2'; g.lineWidth = 13; g.lineCap = 'round';
    g.beginPath(); g.moveTo(110, 56); g.lineTo(96, 94); g.stroke();
    g.beginPath(); g.moveTo(96, 94); g.lineTo(122, 118); g.lineTo(118, 140); g.stroke();
    g.beginPath(); g.moveTo(96, 94); g.lineTo(76, 118); g.lineTo(56, 122); g.stroke();
    g.beginPath(); g.moveTo(108, 62); g.lineTo(136, 78); g.stroke(); g.beginPath(); g.moveTo(106, 64); g.lineTo(80, 74); g.stroke();
    g.fillStyle = '#fbf8f2'; g.beginPath(); g.moveTo(20, 40); g.lineTo(50, 20); g.lineTo(50, 60); g.fill(); g.fillRect(48, 32, 20, 16);
    ftext(g, '一時避難場所', w / 2, 172, w * 0.9, 26, F.sans, 900, '#2f8a57');
    ftext(g, '← 駅前広場', w / 2, 206, w * 0.9, 26, F.sans, 900, '#3a3346');
    ftext(g, 'Evacuation Area', w / 2, 236, w * 0.8, 15, F.en, 700, '#6d6a80');
  }, { key: 'props.evac' });
  t.works = T.draw(256, 384, (g, w, h) => {
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, 64);
    ftext(g, '工事中', w / 2, 34, w * 0.8, 44, F.sans, 900, '#3a3346');
    // bowing worker
    g.fillStyle = '#f2f2f2'; g.strokeStyle = '#3a3346'; g.lineWidth = 3;
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(96, 102, 18, Math.PI * 0.9, Math.PI * 2.1); g.fill(); g.stroke();
    g.fillStyle = '#f4d7c0'; g.beginPath(); g.arc(104, 112, 14, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#3f7bd0'; g.beginPath(); g.moveTo(110, 124); g.lineTo(160, 116); g.lineTo(168, 176); g.lineTo(150, 180); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#4b4d55'; g.fillRect(150, 176, 14, 50); g.fillRect(166, 176, 14, 50);
    g.strokeStyle = '#3a3346'; g.beginPath(); g.moveTo(130, 130); g.lineTo(118, 170); g.stroke();
    ftext(g, 'ご迷惑をおかけします', w / 2, 256, w * 0.92, 26, F.sans, 900, '#d9463b');
    ftext(g, '下水道管の点検をしています', w / 2, 290, w * 0.92, 18, F.sans, 700, '#3a3346');
    ftext(g, '期間 4月13日〜4月24日', w / 2, 318, w * 0.9, 17, F.sans, 700, '#3a3346');
    ftext(g, '桜ヶ丘町 上下水道課', w / 2, 350, w * 0.9, 17, F.sans, 900, '#2f64b5');
  }, { key: 'props.works' });
  t.manhole = T.draw(256, 256, (g, w, h) => {
    g.fillStyle = '#8a8680'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a6660'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, 118, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, 100, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(w / 2, h / 2);
    for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * Math.PI * 2 / 5); sakuraFlower(g, 0, -56, 26, '#9e9a92', '#77736c'); g.restore(); }
    sakuraFlower(g, 0, 0, 34, '#a6a29a', '#77736c');
    g.restore();
    g.fillStyle = '#6a6660'; g.font = `900 16px ${F.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('桜ヶ丘町', w / 2, 30); g.fillText('下 水', w / 2, h - 30);
  }, { key: 'props.manhole' });
  t.bar = T.draw(128, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3f3a48' : '#f2c230'; g.beginPath(); g.moveTo(i * 16 - 8, h); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 8, h); g.fill(); } }, { key: 'props.conebar', repeat: [4, 1] });
  t.mesh = T.draw(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#4f8a6a'; g.lineWidth = 3;
    for (let x = 2; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 2; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { key: 'props.garbage.mesh', repeat: [1, 1] });
  t.gomi = T.draw(256, 192, (g, w, h) => {
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f8f5b'; g.fillRect(0, 0, w, 40);
    ftext(g, 'ゴミ集積所', w / 2, 21, w * 0.9, 28, F.sans, 900, '#ffffff');
    [['月・木', '燃えるごみ', '#d9463b'], ['火', 'プラスチック', '#2f6fc9'], ['第2・4 水', 'びん・缶・ペット', '#3f8f5b'], ['金', '古紙・布', '#8a6446']].forEach(([d, k, c], i) => {
      g.fillStyle = c; rr(g, 10, 50 + i * 28, 78, 22, 5); g.fill();
      ftext(g, d, 49, 61 + i * 28, 72, 14, F.sans, 900, '#ffffff');
      ftext(g, k, 100, 61 + i * 28, 150, 16, F.sans, 700, '#3a3346', 'left');
    });
    ftext(g, '収集日の朝8時30分までに', w / 2, 170, w * 0.92, 14, F.sans, 900, '#d9463b');
    ftext(g, '桜ヶ丘町内会 北町班', w / 2, 186, w * 0.9, 10, F.sans, 700, '#6d6a80');
  }, { key: 'props.garbage.sign' });
  _tex = t;
  return t;
}

/** Red 消火器 box on a short post. p = {x,z,rotY} (box faces local +Z). */
export function fireBox(ctx, H, p, yFixed) {
  const { mat, physics } = ctx;
  const t = textures(ctx);
  const y0 = yFixed !== undefined ? yFixed : H.footprint(p.x, p.z, 0.3, 0.24, p.rotY).max;
  const g = H.place(p.x, y0, p.z, p.rotY);
  const k = ctx.kit(g);
  const steel = mat.toon('#9aa1a8', { paint: 0.03 }), red = mat.toon('#d9463b', { paint: 0.04 });
  k.box(0.18, 0.02, 0.18, steel, [0, 0.0, 0]);
  k.cyl(0.028, 0.028, 0.5, steel, [0, 0.25, 0], null, 10);
  k.rbox(0.32, 0.52, 0.2, 0.02, red, [0, 0.76, 0]);
  k.box(0.35, 0.03, 0.23, red, [0, 1.035, 0.0], [0.08, 0, 0]);
  k.plane(0.26, 0.42, mat.toon('#ffffff', { map: t.fire, paint: 0.02 }), [0, 0.77, 0.1015]);
  k.box(0.1, 0.025, 0.03, steel, [0, 0.53, 0.11]);
  physics.addCylinder(p.x, p.z, 0.2, y0 - 0.1, y0 + 1.05);
}

export function buildScatter(ctx, H) {
  const { L, mat, physics } = ctx;
  const t = textures(ctx);
  const rnd = ctx.rng('props.scatter');
  const M = {
    iron: mat.toon('#4d6457', { paint: 0.04 }),
    bench: mat.toon('#ffffff', { map: t.wood, paint: 0.05 }),
    benchAd: mat.toon('#ffffff', { map: t.bench, paint: 0.04 }),
    steel: mat.toon('#9aa1a8', { paint: 0.03 }),
    steelDark: mat.toon('#6d747c', { paint: 0.03 }),
    concrete: mat.toon('#c4c2ba', { paint: 0.08 }),
    ink: mat.toon('#3a3346', { paint: 0 }),
    white: mat.toon('#eeeeea', { paint: 0.02 }),
    glass: mat.glass({ tint: '#dde8ef', opacity: 0.08, streaks: true }),
  };

  // ---------------------------------------------------------------- V5 bench (seat y 0.44 above its floor)
  {
    const s = L.SPOTS.v5Bench; const len = s.len || 1.5;
    const fp = H.footprint(s.x, s.z, len, 0.6, s.rotY);
    const g = H.place(s.x, fp.max, s.z, s.rotY); const k = ctx.kit(g);
    const seatY = s.seatY ?? 0.44;
    for (const sx of [-1, 1]) {
      const x = sx * (len / 2 - 0.1);
      k.box(0.05, seatY - 0.035 + (fp.max - fp.min) + 0.02, 0.05, M.iron, [x, (seatY - 0.035 - (fp.max - fp.min) - 0.02) / 2, 0.2]);
      k.box(0.05, 0.86 + (fp.max - fp.min) + 0.02, 0.05, M.iron, [x, (0.86 - (fp.max - fp.min) - 0.02) / 2, -0.21], [-0.1, 0, 0]);
      k.box(0.05, 0.05, 0.5, M.iron, [x, seatY - 0.06, -0.01]);
      k.box(0.05, 0.035, 0.44, M.iron, [x, 0.64, 0.02]);
      k.box(0.04, 0.2, 0.04, M.iron, [x, 0.53, 0.22]);
      k.box(0.05, 0.03, 0.4, M.iron, [x, 0.08, 0.0]);
    }
    for (let i = 0; i < 4; i++) k.box(len, 0.035, 0.095, M.bench, [0, seatY - 0.0175, -0.165 + i * 0.11]);
    k.box(len, 0.1, 0.03, M.bench, [0, 0.58, -0.245], [-0.1, 0, 0]);
    k.box(len, 0.16, 0.03, M.bench, [0, 0.76, -0.265], [-0.1, 0, 0]);
    k.plane(len * 0.98, 0.15, M.benchAd, [0, 0.76, -0.2485], [-0.1, 0, 0]);
    physics.addBox(s.x, s.z, len + 0.05, 0.62, s.rotY, fp.min - 0.1, fp.max + 0.86);
  }

  // ---------------------------------------------------------------- gashapon (capsule-toy machines) at the general store front
  {
    const s = L.SPOTS.gashapon; const n = s.count || 3; const step = 0.47, total = n * step;
    const fp = H.footprint(s.x, s.z, total + 0.1, 0.5, s.rotY);
    const g = H.place(s.x, fp.max, s.z, s.rotY); const k = ctx.kit(g);
    const drop = fp.max - fp.min + 0.03;
    k.box(total + 0.04, 0.05, 0.46, M.steelDark, [0, 0.275, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.04, 0.3 + drop, 0.04, M.steelDark, [sx * (total / 2 - 0.02), (0.3 - drop) / 2, sz * 0.2]);
    k.box(total, 0.03, 0.03, M.steelDark, [0, 0.06, 0.2]);
    const frames = ['#ec7f72', '#72a9de', '#f0cd5c', '#9ad7a8'];
    const capCols = ['#f28b9b', '#7fc4e8', '#f6d55c', '#9ad7a8', '#c9a7e8', '#f7a86b', '#f5f0e6'];
    const capM = [];
    for (let j = 0; j < n; j++) {
      const x = -total / 2 + step * (j + 0.5);
      const mg = new THREE.Group(); mg.position.set(x, 0.3, 0); g.add(mg); const m = ctx.kit(mg);
      const fm = mat.toon(frames[j % frames.length], { paint: 0.04 });
      m.rbox(0.44, 0.46, 0.42, 0.025, fm, [0, 0.23, 0]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(0.03, 0.42, 0.03, fm, [sx * 0.205, 0.67, sz * 0.195]);
      m.rbox(0.44, 0.05, 0.42, 0.02, fm, [0, 0.885, 0]);
      m.box(0.38, 0.012, 0.38, M.white, [0, 0.466, 0]);
      const gl = m.plane(0.38, 0.4, M.glass, [0, 0.66, 0.2]); ctx.noOutline(gl); gl.castShadow = false;
      for (const sx of [-1, 1]) { const gs = m.plane(0.36, 0.4, M.glass, [sx * 0.21, 0.66, 0], [0, sx * Math.PI / 2, 0]); ctx.noOutline(gs); gs.castShadow = false; }
      m.box(0.38, 0.4, 0.01, M.white, [0, 0.66, -0.19]);
      m.plane(0.34, 0.2125, mat.emissive('#ffffff', 0.92, { map: t.cards[j % t.cards.length] }), [0, 0.76, 0.17]);
      m.rbox(0.25, 0.2, 0.02, 0.01, M.steel, [0, 0.3, 0.215]);
      m.plane(0.2, 0.075, mat.toon('#ffffff', { map: t.price, paint: 0.01 }), [0, 0.365, 0.2265]);
      m.cyl(0.058, 0.058, 0.035, M.white, [0, 0.27, 0.24], [Math.PI / 2, 0, 0], 20);
      m.box(0.11, 0.022, 0.02, M.steelDark, [0, 0.27, 0.265], [0, 0, 0.35 + j * 0.6]);
      m.box(0.018, 0.04, 0.012, M.ink, [0.09, 0.265, 0.232]);
      m.box(0.13, 0.09, 0.02, M.ink, [0, 0.09, 0.212]);
      m.box(0.12, 0.08, 0.01, mat.toon('#8e98a8', { paint: 0.01 }), [0, 0.09, 0.224], [-0.12, 0, 0]);
      // capsule pile (merged below)
      mg.updateMatrixWorld(true);
      for (let ly = 0; ly < 3; ly++) for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 4; iz++) {
        if (ly === 2 && rnd() < 0.45) continue;
        const px = -0.16 + ix * 0.08 + (rnd() - 0.5) * 0.02, pz = -0.15 + iz * 0.1 + (rnd() - 0.5) * 0.03;
        const py = 0.472 + 0.03 + ly * 0.05 + (rnd() - 0.5) * 0.012;
        capM.push({ g: mg, pos: new THREE.Vector3(px, py, pz), rot: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), col: capCols[(rnd() * capCols.length) | 0] });
      }
    }
    // lit header
    k.box(total, 0.16, 0.1, M.white, [0, 0.3 + 0.91 + 0.08, 0]);
    k.plane(total - 0.04, 0.13, mat.emissive('#ffffff', 1.05, { map: t.gachaHead }), [0, 0.3 + 0.91 + 0.08, 0.0505]);
    g.updateMatrixWorld(true);
    // all capsules -> ONE vertex-coloured mesh (coloured bottom half, clear-white top half)
    const bot = new THREE.SphereGeometry(0.029, 9, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).toNonIndexed();
    const top = new THREE.SphereGeometry(0.029, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    const per = bot.attributes.position.count + top.attributes.position.count;
    const P = new Float32Array(capM.length * per * 3), N = new Float32Array(capM.length * per * 3), C = new Float32Array(capM.length * per * 3);
    const m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color(), cw = new THREE.Color('#f3f5f7'), v = new THREE.Vector3();
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    capM.forEach((e, i) => {
      m4.compose(e.pos, q.setFromEuler(e.rot), one).premultiply(e.g.matrixWorld).premultiply(inv); nm.getNormalMatrix(m4);
      c.set(e.col);
      let o = i * per;
      for (const [geo, col] of [[bot, c], [top, cw]]) {
        const p = geo.attributes.position, nn = geo.attributes.normal;
        for (let j = 0; j < p.count; j++, o++) {
          v.fromBufferAttribute(p, j).applyMatrix4(m4); P.set([v.x, v.y, v.z], o * 3);
          v.fromBufferAttribute(nn, j).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], o * 3);
          C.set([col.r, col.g, col.b], o * 3);
        }
      }
    });
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(P, 3)); cg.setAttribute('normal', new THREE.BufferAttribute(N, 3)); cg.setAttribute('color', new THREE.BufferAttribute(C, 3));
    cg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(capM.length * per * 2), 2));
    const caps = k.mesh(cg, mat.toon('#ffffff', { vertexColors: true, paint: 0.02 }), [0, 0, 0]);
    caps.castShadow = false;
    physics.addBox(s.x, s.z, total + 0.06, 0.48, s.rotY, fp.min - 0.1, fp.max + 1.4);
  }

  // ---------------------------------------------------------------- 防災倉庫 (disaster-supply storehouse) + evac sign + extinguisher
  {
    const s = L.SPOTS.disasterCabinet;
    const fp = H.footprint(s.x, s.z, 1.96, 1.06, s.rotY);
    const y0 = fp.max + 0.1;
    const g = H.place(s.x, y0, s.z, s.rotY); const k = ctx.kit(g);
    k.boxB(1.98, y0 - fp.min + 0.06, 1.08, M.concrete, [0, fp.min - y0 - 0.06, 0]);
    const body = mat.toon('#ffffff', { map: t.ribs, paint: 0.05 });
    k.box(1.8, 1.72, 0.9, body, [0, 0.86, 0]);
    k.box(1.92, 0.07, 1.02, mat.toon('#98a1a8', { paint: 0.05 }), [0, 1.755, 0.0], [-0.05, 0, 0]);
    const door = mat.toon('#d3d8da', { paint: 0.05 });
    for (const sx of [-1, 1]) {
      k.rbox(0.86, 1.52, 0.03, 0.01, door, [sx * 0.44, 0.84, 0.46]);
      for (let i = 0; i < 5; i++) k.box(0.5, 0.018, 0.02, M.steelDark, [sx * 0.44, 0.22 + i * 0.045, 0.482], [0.5, 0, 0]);
      k.box(0.03, 0.22, 0.035, M.steelDark, [sx * 0.06, 0.92, 0.49]);
    }
    k.cyl(0.018, 0.018, 0.03, M.steel, [0.12, 1.08, 0.485], [Math.PI / 2, 0, 0], 10);
    k.plane(1.2, 0.3, mat.toon('#ffffff', { map: t.cabLabel, paint: 0.01 }), [0, 1.42, 0.4775]);
    k.plane(0.36, 0.3, mat.toon('#ffffff', { map: t.cabList, paint: 0.01 }), [0.44, 1.0, 0.4775]);
    k.box(1.84, 0.06, 0.94, M.steelDark, [0, 0.03, 0]);
    physics.addBox(s.x, s.z, 1.98, 1.08, s.rotY, fp.min - 0.1, y0 + 1.8);
    const pe = H.toWorld(s.x, s.z, s.rotY, 1.28, 0.25); fireBox(ctx, H, { x: pe.x, z: pe.z, rotY: s.rotY - 0.15 });
    const ps = H.toWorld(s.x, s.z, s.rotY, -1.35, 0.35);
    const ys = H.footprint(ps.x, ps.z, 0.1, 0.1, 0).max;
    const sg = H.place(ps.x, ys, ps.z, s.rotY + 0.1); const kk = ctx.kit(sg);
    kk.cyl(0.03, 0.03, 2.3, M.steel, [0, 1.15, 0], null, 10);
    kk.box(0.47, 0.62, 0.02, M.steel, [0, 1.95, 0.04]);
    kk.plane(0.45, 0.6, mat.toon('#ffffff', { map: t.evac, paint: 0.01 }), [0, 1.95, 0.0505]);
    physics.addCylinder(ps.x, ps.z, 0.08, ys - 0.1, ys + 2.3);
  }

  // ---------------------------------------------------------------- 消火器 boxes at a few corners
  const fb = (x, z, rotY) => fireBox(ctx, H, { x, z, rotY });
  fb(-8.86, -60.7, -Math.PI / 2);           // quiet corner by V4 (R2/R4)
  fb(-15.28, -18.4, Math.PI / 2);           // R2 west side, by pole R2W
  { const f = L.streetFrame(84.6, 1, 4.38); fb(f.x, f.z, f.rotY); } // main street, east sidewalk

  // ---------------------------------------------------------------- R4: manhole inspection with cones + notice
  {
    const cx = 6.2, cz = -55.05;
    const y = L.heightAt(cx, cz) + 0.012;
    const mh = mat.toon('#ffffff', { map: t.manhole, paint: 0.03 });
    const g = H.place(cx, y, cz, 0.3); const k = ctx.kit(g);
    k.cyl(0.33, 0.33, 0.03, mh, [0, 0.0, 0], null, 28).castShadow = false;
    const orange = mat.toon('#ec6f45', { paint: 0.03 }), white = mat.toon('#f4f2ee', { paint: 0.01 }), rubber = mat.toon('#4a4552', { paint: 0.02 });
    const conePts = [[-0.85, -0.6], [0.85, -0.6], [0.85, 0.62], [-0.85, 0.62]];
    const coneAt = (lx, lz) => {
      const p = H.toWorld(cx, cz, 0.3, lx, lz);
      const cy = L.heightAt(p.x, p.z) + 0.012;
      const cg = H.place(p.x, cy, p.z, rnd() * 3); const c = ctx.kit(cg);
      c.box(0.36, 0.035, 0.36, rubber, [0, 0.0175, 0]);
      c.mesh(new THREE.CylinderGeometry(0.028, 0.13, 0.64, 18), orange, [0, 0.035 + 0.32, 0]);
      c.mesh(new THREE.CylinderGeometry(0.075, 0.094, 0.1, 18), white, [0, 0.035 + 0.38, 0]);
      c.mesh(new THREE.CylinderGeometry(0.052, 0.066, 0.07, 18), white, [0, 0.035 + 0.52, 0]);
      physics.addCylinder(p.x, p.z, 0.17, cy - 0.1, cy + 0.7);
      return { x: p.x, y: cy, z: p.z };
    };
    const cones = conePts.map(([a, b]) => coneAt(a, b));
    const barM = mat.toon('#ffffff', { map: t.bar, paint: 0.01 });
    for (const [i, j] of [[0, 1], [1, 2]]) {
      const a = new THREE.Vector3(cones[i].x, cones[i].y + 0.56, cones[i].z), b = new THREE.Vector3(cones[j].x, cones[j].y + 0.56, cones[j].z);
      const mid = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, d.length(), 10), barM);
      bar.position.copy(mid); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      bar.castShadow = true; bar.receiveShadow = true; ctx.addStatic(bar);
    }
    // A-frame notice facing westbound traffic (from the east), printed on both faces
    const sx = cx + 1.75, sz = cz + 0.25;
    const ys = L.heightAt(sx, sz) + 0.012;
    const sg = H.place(sx, ys, sz, Math.PI / 2 - 0.2);
    const frame = mat.toon('#e9e7e2', { paint: 0.02 });
    const worksMat = mat.toon('#ffffff', { map: t.works, paint: 0.01 });
    for (const side of [1, -1]) {
      // the two panels hinge together at the top, feet spread ~0.44 m apart
      const fg = new THREE.Group(); fg.rotation.x = -side * 0.2; fg.position.set(0, 0, side * 0.222); sg.add(fg); const f = ctx.kit(fg);
      f.box(0.6, 0.9, 0.02, frame, [0, 0.62, 0]);
      f.plane(0.56, 0.84, worksMat, [0, 0.62, side * 0.0105], [0, side > 0 ? 0 : Math.PI, 0]);
      for (const lx of [-0.29, 0.29]) f.box(0.03, 1.12, 0.03, M.steel, [lx, 0.54, -side * 0.025]);
    }
    physics.addBox(sx, sz, 0.66, 0.5, Math.PI / 2 - 0.2, ys - 0.1, ys + 1.1);
  }

  // ---------------------------------------------------------------- ゴミ集積所 on the R4 rail-side strip (faces the lane, north)
  {
    const gx = -27.5, gz = -53.0, rot = Math.PI;
    const fp = H.footprint(gx, gz, 1.9, 1.0, rot);
    const y0 = fp.max + 0.06;
    const g = H.place(gx, y0, gz, rot); const k = ctx.kit(g);
    k.boxB(1.9, y0 - fp.min + 0.08, 1.0, M.concrete, [0, fp.min - y0 - 0.08, 0]);
    const green = mat.toon('#5d8f6c', { paint: 0.04 });
    const W2 = 0.8, D2 = 0.42, Hh = 0.86;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, Hh, 0.035, green, [sx * W2, Hh / 2, sz * D2]);
    for (const y of [0.02, Hh]) { for (const sz of [-1, 1]) k.box(W2 * 2, 0.03, 0.03, green, [0, y, sz * D2]); for (const sx of [-1, 1]) k.box(0.03, 0.03, D2 * 2, green, [sx * W2, y, 0]); }
    const meshMat = mat.toon('#ffffff', { map: t.mesh, alphaTest: 0.5, side: 'double', paint: 0.01 });
    const panel = (w, h, pos, rot2, rep) => { const pg = new THREE.PlaneGeometry(w, h); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep[0], uv.getY(i) * rep[1]); const m = k.mesh(pg, meshMat, pos, rot2); ctx.noOutline(m); m.castShadow = false; return m; };
    panel(W2 * 2, Hh, [0, Hh / 2, D2], [0, 0, 0], [W2 * 2 / 0.25, Hh / 0.25]);
    panel(W2 * 2, Hh, [0, Hh / 2, -D2], [0, 0, 0], [W2 * 2 / 0.25, Hh / 0.25]);
    for (const sx of [-1, 1]) panel(D2 * 2, Hh, [sx * W2, Hh / 2, 0], [0, Math.PI / 2, 0], [D2 * 2 / 0.25, Hh / 0.25]);
    // lid (closed, slightly domed frame)
    const lid = new THREE.Group(); lid.position.set(0, Hh + 0.02, -D2); lid.rotation.x = -0.02; g.add(lid); const kl = ctx.kit(lid);
    for (const sx of [-1, 1]) kl.box(0.03, 0.03, D2 * 2 + 0.04, green, [sx * (W2 + 0.02), 0, D2]);
    kl.box(W2 * 2 + 0.07, 0.03, 0.03, green, [0, 0, D2 * 2 + 0.02]);
    const lp = new THREE.PlaneGeometry(W2 * 2, D2 * 2); const uv = lp.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W2 * 2 / 0.25, uv.getY(i) * D2 * 2 / 0.25);
    const lm = kl.mesh(lp, meshMat, [0, 0.005, D2], [-Math.PI / 2, 0, 0]); ctx.noOutline(lm); lm.castShadow = false;
    // folded crow net on the lid + sign on the front
    const netM = mat.toon('#4f86c8', { paint: 0.08 });
    k.rbox(1.25, 0.055, 0.26, 0.025, netM, [0.08, Hh + 0.06, -0.22], [0, 0.04, 0.02]);
    k.rbox(0.9, 0.05, 0.2, 0.022, netM, [0.02, Hh + 0.105, -0.2], [0.05, -0.06, -0.03]);
    k.rbox(0.28, 0.35, 0.03, 0.012, netM, [0.66, Hh - 0.12, -D2 - 0.03], [0.05, 0, 0.1]);
    k.box(0.52, 0.38, 0.015, M.white, [0, Hh - 0.24, D2 + 0.03]);
    k.plane(0.5, 0.375, mat.toon('#ffffff', { map: t.gomi, paint: 0.01 }), [0, Hh - 0.24, D2 + 0.0385]);
    physics.addBox(gx, gz, 1.9, 1.0, rot, fp.min - 0.1, y0 + 1.0);
  }
}
