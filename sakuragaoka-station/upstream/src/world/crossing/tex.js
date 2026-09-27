// Canvas textures for the level crossing (踏切). Everything is cached by key and drawn with a
// seeded RNG so screenshots are deterministic. Kept small (total well under 2 Mpx).

export const INK = '#3a3346';          // "black" of the yellow/black hazard stripes (never pure black)
export const HAZ_YELLOW = '#f0c23a';   // hazard yellow

export function makeCrossingTextures(ctx) {
  const { tex } = ctx;
  const F = tex.FONTS;
  const T = {};
  const rngFor = (s) => ctx.rng('crossing-tex-' + s);
  // Atlas items: small non-tiling images (signs, plates, road symbols) are packed into two shared
  // canvases so the whole crossing needs only one sign material and one road-symbol material.
  const ATL = { sign: [], road: [] };
  const item = (atlas, name, w, h, fn) => { ATL[atlas].push({ name, w, h, fn }); };

  // soft irregular blob helper (hand-painted stains)
  const blob = (g, x, y, r, rnd) => {
    g.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, rr = r * (0.7 + 0.3 * rnd());
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.8;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fill();
  };

  // ------------------------------------------------------------ diagonal hazard stripes
  // One diagonal period per tile so the pattern wraps seamlessly around a cylinder (helix).
  const diag = (g, w, h, flip) => {
    g.fillStyle = HAZ_YELLOW; g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    for (let k = -2; k <= 3; k++) {
      g.beginPath();
      if (!flip) { g.moveTo(k * w, 0); g.lineTo(k * w + w / 2, 0); g.lineTo(k * w + w / 2 - w, h); g.lineTo(k * w - w, h); }
      else { g.moveTo(k * w, 0); g.lineTo(k * w + w / 2, 0); g.lineTo(k * w + w / 2 + w, h); g.lineTo(k * w + w, h); }
      g.closePath(); g.fill();
    }
  };
  const scuffs = (g, w, h, rnd, n = 14) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(255,248,230,${0.05 + rnd() * 0.08})`;
      blob(g, rnd() * w, rnd() * h, 3 + rnd() * 8, rnd);
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgba(90,70,60,${0.05 + rnd() * 0.06})`;
      blob(g, rnd() * w, h * (0.6 + rnd() * 0.4), 2 + rnd() * 5, rnd);
    }
  };
  T.postStripe = (vRepeat) => tex.draw(128, 128, (g, w, h) => { diag(g, w, h, false); scuffs(g, w, h, rngFor('post')); },
    { key: 'crossing.postStripe.' + vRepeat.toFixed(2), repeat: [1, vRepeat] });
  T.machStripe = tex.draw(128, 128, (g, w, h) => { diag(g, w, h, false); scuffs(g, w, h, rngFor('mach'), 10); },
    { key: 'crossing.machStripe', repeat: [1, 2.4] });


  // crossbuck boards (踏切警標): yellow with black diagonal stripes, thin dark border
  const buck = (flip) => (g, w, h) => {
    g.fillStyle = HAZ_YELLOW; g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    const P = 46;
    for (let x = -h - P; x < w + h + P; x += P) {
      g.beginPath();
      if (!flip) { g.moveTo(x, 0); g.lineTo(x + P / 2, 0); g.lineTo(x + P / 2 - h, h); g.lineTo(x - h, h); }
      else { g.moveTo(x, 0); g.lineTo(x + P / 2, 0); g.lineTo(x + P / 2 + h, h); g.lineTo(x + h, h); }
      g.closePath(); g.fill();
    }
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(3, 3, w - 6, 3);
  };
  item('sign', 'buckA', 256, 40, buck(false));
  item('sign', 'buckB', 256, 40, buck(true));

  // ------------------------------------------------------------ deck surfaces
  // rubber crossing panel (ゴム踏切板): greyscale, tinted by the material colour
  T.rubber = tex.draw(256, 256, (g, w, h) => {
    const rnd = rngFor('rubber');
    g.fillStyle = '#c9c9cb'; g.fillRect(0, 0, w, h);
    // anti-slip studs (raised rounded bars in a brick pattern)
    for (let j = 0; j < 11; j++) {
      for (let i = 0; i < 9; i++) {
        const x = 18 + i * 25 + (j % 2 ? 12 : 0), y = 20 + j * 21;
        if (x > w - 24) continue;
        g.fillStyle = '#b3b3b6'; tex.roundRect(g, x, y, 15, 9, 4); g.fill();
        g.fillStyle = '#dadadc'; tex.roundRect(g, x + 1, y, 13, 3, 2); g.fill();
      }
    }
    // wear: slightly polished wheel paths & soft stains
    for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(235,235,235,${0.05 + rnd() * 0.08})`; blob(g, rnd() * w, rnd() * h, 10 + rnd() * 24, rnd); }
    for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(80,76,86,${0.05 + rnd() * 0.07})`; blob(g, rnd() * w, rnd() * h, 6 + rnd() * 16, rnd); }
    // panel joint groove + bevel
    g.strokeStyle = '#7e7d84'; g.lineWidth = 7; g.strokeRect(3.5, 3.5, w - 7, h - 7);
    g.strokeStyle = '#dcdcde'; g.lineWidth = 2; g.strokeRect(9, 9, w - 18, h - 18);
    // bolt caps near the corners
    for (const [x, y] of [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]]) {
      g.fillStyle = '#8f8e95'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b9b9bd'; g.beginPath(); g.arc(x - 1, y - 1, 3.5, 0, Math.PI * 2); g.fill();
    }
  }, { key: 'crossing.rubber' });

  // asphalt of the deck (4 m tile, world UV)
  T.asphalt = tex.draw(512, 512, (g, w, h) => {
    const rnd = rngFor('asph');
    g.fillStyle = '#6d6f74'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '120,122,128' : '96,98,104'},${0.25 + rnd() * 0.25})`; blob(g, rnd() * w, rnd() * h, 20 + rnd() * 60, rnd); }
    for (let i = 0; i < 2600; i++) { const c = rnd() < 0.5 ? 140 + rnd() * 30 : 80 + rnd() * 20; g.fillStyle = `rgba(${c},${c},${c + 4},${0.35 + rnd() * 0.3})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    // a repair patch
    g.fillStyle = 'rgba(88,90,96,0.55)'; g.fillRect(300, 60, 130, 90);
    g.strokeStyle = 'rgba(70,70,78,0.5)'; g.lineWidth = 2; g.strokeRect(300, 60, 130, 90);
    // hairline cracks
    g.strokeStyle = 'rgba(66,64,72,0.55)'; g.lineWidth = 1.4;
    for (let c = 0; c < 5; c++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.3) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    // oil / tyre darkening streaks along the travel direction (v)
    for (const x of [150, 200, 330, 380]) { g.fillStyle = 'rgba(70,70,78,0.10)'; g.fillRect(x, 0, 26, h); }
  }, { key: 'crossing.asphalt', repeat: [1, 1] });

  // concrete apron around the equipment (2 m tile, world UV)
  T.concrete = tex.draw(256, 256, (g, w, h) => {
    const rnd = rngFor('conc');
    g.fillStyle = '#d2d0c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(${rnd() < 0.6 ? '180,176,166' : '226,224,216'},${0.25 + rnd() * 0.3})`; blob(g, rnd() * w, rnd() * h, 10 + rnd() * 36, rnd); }
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(150,146,140,${0.2 + rnd() * 0.3})`; g.fillRect(rnd() * w, rnd() * h, 1, 1); }
    // expansion joint
    g.fillStyle = 'rgba(120,116,112,0.7)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    // a moss / rain stain
    g.fillStyle = 'rgba(128,146,98,0.18)'; blob(g, 40, 200, 30, rnd);
    g.strokeStyle = 'rgba(110,106,104,0.45)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(150, 30); g.lineTo(162, 70); g.lineTo(158, 110); g.stroke();
  }, { key: 'crossing.concrete', repeat: [1, 1] });

  // worn road paint (white, alpha holes) — tinted per material (white / green)
  T.worn = tex.draw(256, 128, (g, w, h) => {
    const rnd = rngFor('worn');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.5})`; blob(g, rnd() * w, rnd() * h, 1 + rnd() * 4, rnd); }
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.2})`; g.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 60, 1 + rnd() * 2); }
    g.globalCompositeOperation = 'source-over';
  }, { key: 'crossing.worn', repeat: [1, 1] });

  // tactile warning blocks (点状ブロック): 3 × 2 blocks of 0.3 m (one 64 px cell each)
  item('road', 'tactile', 192, 128, (g, w, h) => {
    for (let by = 0; by < 2; by++) for (let bx = 0; bx < 3; bx++) {
      const ox = bx * 64, oy = by * 64;
      g.fillStyle = '#e9c547'; g.fillRect(ox, oy, 64, 64);
      g.fillStyle = '#c9a53a'; g.fillRect(ox, oy, 64, 2); g.fillRect(ox, oy, 2, 64);
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        const x = ox + 8 + i * 12, y = oy + 8 + j * 12;
        g.fillStyle = '#c6a032'; g.beginPath(); g.arc(x + 0.8, y + 1.2, 4.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f7da6c'; g.beginPath(); g.arc(x, y, 3.8, 0, Math.PI * 2); g.fill();
      }
    }
  });
  // linear guide (誘導表示) on the deck walkway
  T.guide = tex.draw(64, 64, (g, w, h) => {
    g.fillStyle = '#e9c547'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { const x = 6 + i * 15; g.fillStyle = '#c6a032'; g.fillRect(x + 1, 3, 8, h - 6); g.fillStyle = '#f6d970'; g.fillRect(x, 2, 7, h - 6); }
  }, { key: 'crossing.guide', repeat: [1, 1] });

  // ------------------------------------------------------------ road markings (transparent)
  const wearOut = (g, w, h, rnd, n) => {
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.5})`; blob(g, rnd() * w, rnd() * h, 1.5 + rnd() * 5, rnd); }
    g.globalCompositeOperation = 'source-over';
  };
  // 止まれ: characters written across the lane, stretched ~2.9x along the travel direction
  item('road', 'tomare', 512, 512, (g, w, h) => {
    const rnd = rngFor('tomare');
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f3f1ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = ['止', 'ま', 'れ'];
    const fs = 158;
    g.font = `900 ${fs}px ${F.sans}`;
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(w * (i + 0.5) / 3, h * 0.5); g.scale(1, 2.95); g.fillText(chars[i], 0, 4); g.restore();
    }
    wearOut(g, w, h, rnd, 260);
  });
  // small hiragana とまれ for the pedestrian band
  item('road', 'tomareSmall', 256, 128, (g, w, h) => {
    const rnd = rngFor('tomareS');
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f3f1ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 70px ${F.round}`;
    const ch = ['と', 'ま', 'れ'];
    for (let i = 0; i < 3; i++) { g.save(); g.translate(w * (i + 0.5) / 3, h * 0.52); g.scale(1, 1.55); g.fillText(ch[i], 0, 2); g.restore(); }
    wearOut(g, w, h, rnd, 60);
  });
  // footprints (a pair, pointing up = forward)
  item('road', 'feet', 128, 128, (g, w, h) => {
    const rnd = rngFor('feet');
    g.clearRect(0, 0, w, h);
    const foot = (cx, cy, mir) => {
      g.save(); g.translate(cx, cy); g.scale(mir, 1);
      g.fillStyle = '#f2cf4c';
      g.beginPath(); g.ellipse(0, 6, 13, 24, 0.08, 0, Math.PI * 2); g.fill();        // sole
      g.beginPath(); g.ellipse(2, 36, 10, 11, 0, 0, Math.PI * 2); g.fill();          // heel
      for (let t = 0; t < 5; t++) { g.beginPath(); g.arc(-10 + t * 5.5, -22 - (t === 0 ? 3 : t < 3 ? 1 : -t), t === 0 ? 5 : 3.4, 0, Math.PI * 2); g.fill(); } // toes
      g.restore();
    };
    foot(42, 58, -1); foot(86, 54, 1);
    wearOut(g, w, h, rnd, 30);
  });
  // blue bicycle guidance chevron (矢羽根), pointing up = forward
  item('road', 'chevron', 128, 128, (g, w, h) => {
    const rnd = rngFor('chev');
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4c86cf';
    g.beginPath();
    g.moveTo(w * 0.08, h * 0.95); g.lineTo(w * 0.5, h * 0.42); g.lineTo(w * 0.92, h * 0.95);
    g.lineTo(w * 0.92, h * 0.62); g.lineTo(w * 0.5, h * 0.08); g.lineTo(w * 0.08, h * 0.62);
    g.closePath(); g.fill();
    wearOut(g, w, h, rnd, 40);
  });
  // 自転車ナビマーク: white bicycle + arrow on a blue rounded plate
  item('road', 'navi', 128, 256, (g, w, h) => {
    const rnd = rngFor('navi');
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4c86cf'; tex.roundRect(g, 6, 6, w - 12, h - 12, 18); g.fill();
    g.strokeStyle = '#f3f1ea'; g.fillStyle = '#f3f1ea'; g.lineCap = 'round'; g.lineJoin = 'round';
    // arrow (top half)
    g.beginPath(); g.moveTo(w / 2, 22); g.lineTo(w / 2 + 34, 70); g.lineTo(w / 2 + 13, 70); g.lineTo(w / 2 + 13, 112); g.lineTo(w / 2 - 13, 112); g.lineTo(w / 2 - 13, 70); g.lineTo(w / 2 - 34, 70); g.closePath(); g.fill();
    // bicycle seen from the side, rotated so it rides "up" (forward)
    g.save(); g.translate(w / 2, 186); g.rotate(-Math.PI / 2); g.scale(1, 1.05);
    g.lineWidth = 6;
    g.beginPath(); g.arc(-30, 12, 19, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(30, 12, 19, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(-30, 12); g.lineTo(-6, -14); g.lineTo(22, -14); g.lineTo(30, 12); g.moveTo(-6, -14); g.lineTo(2, 12); g.lineTo(-30, 12); g.moveTo(2, 12); g.lineTo(22, -14); g.stroke();
    g.beginPath(); g.moveTo(-12, -22); g.lineTo(2, -22); g.moveTo(20, -14); g.lineTo(18, -26); g.lineTo(28, -28); g.stroke();
    g.restore();
    wearOut(g, w, h, rnd, 70);
  });

  // ------------------------------------------------------------ signs / plates
  item('sign', 'namePlate', 384, 300, (g, w, h) => {
    g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f5fa8'; g.fillRect(0, 0, w, 52);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    tex.fitText(g, '踏切名', 16, 27, 120, 30, F.sans, 700);
    g.textAlign = 'right'; tex.fitText(g, '桜川線', w - 16, 27, 140, 28, F.sans, 700);
    g.fillStyle = '#2d2a38'; g.textAlign = 'center';
    tex.fitText(g, '桜ヶ丘第1踏切', w / 2, 96, w - 30, 56, F.sans, 900);
    g.fillStyle = '#5b5868'; tex.fitText(g, 'さくらがおか だい１ ふみきり', w / 2, 136, w - 40, 20, F.sans, 500);
    g.fillStyle = '#d9463b'; g.fillRect(14, 158, w - 28, 34);
    g.fillStyle = '#ffffff'; tex.fitText(g, '緊急連絡先　非常の際はご連絡ください', w / 2, 176, w - 44, 21, F.sans, 700);
    g.fillStyle = '#2d2a38';
    tex.fitText(g, '桜川電鉄 運輸指令所', w / 2, 214, w - 40, 26, F.sans, 700);
    tex.fitText(g, '☎ 0120-000-315（24時間）', w / 2, 250, w - 40, 30, F.sans, 900);
    g.fillStyle = '#6d6a78'; tex.fitText(g, '花見台起点 12k350m　踏切番号 第47号', w / 2, 283, w - 40, 17, F.sans, 500);
    g.strokeStyle = '#2f5fa8'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  });

  item('sign', 'emergency', 224, 320, (g, w, h) => {
    g.fillStyle = '#f1ece0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, 64);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '非常ボタン', w / 2, 34, w - 20, 46, F.sans, 900);
    // recess for the 3D push button
    g.fillStyle = '#d8d2c4'; g.beginPath(); g.arc(w / 2, 142, 52, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#b9b2a2'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#2d2a38';
    tex.fitText(g, '踏切支障報知装置', w / 2, 222, w - 24, 24, F.sans, 700);
    g.fillStyle = '#4a4656';
    tex.fitText(g, '踏切内で車が動けなく', w / 2, 256, w - 24, 18, F.sans, 500);
    tex.fitText(g, 'なった時などに押してください', w / 2, 280, w - 24, 18, F.sans, 500);
    g.strokeStyle = '#d9463b'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });

  item('sign', 'tomareMiyo', 192, 256, (g, w, h) => {
    g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2d2a38'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#d23f36'; tex.fitText(g, 'とまれ', w / 2, 82, w - 30, 64, F.sans, 900);
    g.fillStyle = '#2d2a38'; tex.fitText(g, 'みよ', w / 2, 170, w - 50, 66, F.sans, 900);
    g.fillStyle = '#6d6a78'; tex.fitText(g, '桜川電鉄', w / 2, 228, w - 60, 18, F.sans, 700);
  });

  item('sign', 'chui', 256, 160, (g, w, h) => {
    g.fillStyle = '#f2c73e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2d2a38'; g.lineWidth = 7; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#2d2a38'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '踏切注意', w / 2, 66, w - 40, 64, F.sans, 900);
    tex.fitText(g, '一時停止・左右確認', w / 2, 122, w - 44, 24, F.sans, 700);
  });

  item('sign', 'kinshi', 256, 160, (g, w, h) => {
    g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, 50);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '危 険', w / 2, 27, w - 40, 38, F.sans, 900);
    g.fillStyle = '#d23f36'; tex.fitText(g, '線路内立入禁止', w / 2, 90, w - 28, 40, F.sans, 900);
    g.fillStyle = '#2d2a38'; tex.fitText(g, '桜川電鉄', w / 2, 136, w - 90, 22, F.sans, 700);
    g.strokeStyle = '#d9463b'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  });

  // control cabinet door (踏切制御器)
  item('sign', 'cabinet', 256, 400, (g, w, h) => {
    const rnd = rngFor('cab');
    g.fillStyle = '#e4e6e6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(160,166,170,${0.1 + rnd() * 0.15})`; blob(g, rnd() * w, rnd() * h, 14 + rnd() * 30, rnd); }
    // door seams
    g.strokeStyle = '#8f969c'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath(); g.moveTo(w / 2, 16); g.lineTo(w / 2, h - 16); g.stroke();
    g.strokeStyle = '#f6f7f6'; g.lineWidth = 2; g.strokeRect(19, 19, w - 38, h - 38);
    // louvres
    for (let i = 0; i < 6; i++) { const y = h - 110 + i * 13; g.fillStyle = '#9ba2a8'; g.fillRect(34, y, w / 2 - 54, 6); g.fillRect(w / 2 + 20, y, w / 2 - 54, 6); }
    // label plate
    g.fillStyle = '#f7f6f0'; g.fillRect(34, 46, w - 68, 70); g.strokeStyle = '#6f7479'; g.lineWidth = 2; g.strokeRect(34, 46, w - 68, 70);
    g.fillStyle = '#2d2a38'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '踏切制御器', w / 2, 70, w - 90, 26, F.sans, 900);
    tex.fitText(g, '桜ヶ丘第1踏切  SK07-1', w / 2, 100, w - 90, 16, F.sans, 700);
    // yellow warning triangle
    g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(w / 2, 142); g.lineTo(w / 2 + 34, 200); g.lineTo(w / 2 - 34, 200); g.closePath(); g.fill();
    g.strokeStyle = '#2d2a38'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#2d2a38'; tex.fitText(g, '⚡', w / 2, 180, 30, 30, F.sans, 900);
    tex.fitText(g, '高電圧注意', w / 2, 222, w - 100, 22, F.sans, 900);
    // rain streaks
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(130,120,110,0.12)'; g.fillRect(20 + rnd() * (w - 40), 20, 2 + rnd() * 3, 80 + rnd() * 200); }
  });

  item('sign', 'relay', 192, 288, (g, w, h) => {
    const rnd = rngFor('relay');
    g.fillStyle = '#e1e3e2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(160,166,170,${0.1 + rnd() * 0.15})`; blob(g, rnd() * w, rnd() * h, 12 + rnd() * 24, rnd); }
    g.strokeStyle = '#8f969c'; g.lineWidth = 4; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#f7f6f0'; g.fillRect(28, 36, w - 56, 50);
    g.fillStyle = '#2d2a38'; g.textAlign = 'center'; g.textBaseline = 'middle';
    tex.fitText(g, '踏切器具箱', w / 2, 61, w - 70, 24, F.sans, 900);
    g.fillStyle = '#d9463b'; tex.fitText(g, '関係者以外 開扉禁止', w / 2, 118, w - 50, 16, F.sans, 700);
    for (let i = 0; i < 5; i++) { g.fillStyle = '#9ba2a8'; g.fillRect(36, h - 90 + i * 12, w - 72, 5); }
  });

  // speaker grille (警報音発生器): slotted plate
  item('sign', 'grille', 64, 64, (g, w, h) => {
    g.fillStyle = '#8c9097'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const y = 8 + i * 9; g.fillStyle = '#3f4148'; tex.roundRect(g, 7, y, w - 14, 4.5, 2); g.fill(); g.fillStyle = '#a9adb3'; g.fillRect(8, y + 5, w - 16, 1); }
  });

  // ------------------------------------------------------------ cut-outs (noOutline)
  T.mesh = tex.draw(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h);
    g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, -h / 2); g.moveTo(w / 2, h * 1.5); g.lineTo(w * 1.5, h / 2);
    g.moveTo(w / 2, -h / 2); g.lineTo(w * 1.5, h / 2); g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h * 1.5);
    g.stroke();
  }, { key: 'crossing.mesh', repeat: [1, 1] });

  T.grass = tex.draw(128, 128, (g, w, h) => {
    const rnd = rngFor('grass');
    g.clearRect(0, 0, w, h);
    const cols = ['#7ea85f', '#93bb6c', '#6c9a55', '#a9c97c'];
    for (let i = 0; i < 34; i++) {
      const x0 = w * (0.18 + rnd() * 0.64), len = h * (0.35 + rnd() * 0.55), bend = (rnd() - 0.5) * 34;
      g.strokeStyle = cols[i % cols.length]; g.lineWidth = 2.4 + rnd() * 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + bend * 0.3, h - len * 0.6, x0 + bend, h - len); g.stroke();
    }
    // two dandelions + a tiny white clover flower
    for (const [x, y, c] of [[40, 44, '#f2cf3c'], [92, 60, '#f2cf3c'], [70, 80, '#f4f1ea']]) {
      g.strokeStyle = '#6c9a55'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 2, y); g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(x + 2, y, c === '#f4f1ea' ? 5 : 7.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(230,160,40,0.6)'; g.beginPath(); g.arc(x + 2, y, 2.5, 0, Math.PI * 2); g.fill();
    }
  }, { key: 'crossing.grass' });

  // ------------------------------------------------------------ pack the atlases (shelf packer)
  // T.rect[name] = [u0, v0, u1, v1] (three.js UV space, flipY: v = 1 at the canvas top)
  T.rect = {};
  const pack = (list, key, transparent) => {
    const S = 1024, PAD = 6;
    const items = [...list].sort((a, b) => b.h - a.h || b.w - a.w);
    let x = 0, y = 0, shelfH = 0;
    for (const it of items) {
      if (x + it.w > S) { x = 0; y += shelfH + PAD; shelfH = 0; }
      it.x = x; it.y = y; x += it.w + PAD; shelfH = Math.max(shelfH, it.h);
    }
    const H = Math.ceil((y + shelfH) / 64) * 64;
    const t = tex.draw(S, H, (g) => {
      if (transparent) g.clearRect(0, 0, S, H); else { g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, S, H); }
      for (const it of items) {
        g.save(); g.translate(it.x, it.y);
        g.beginPath(); g.rect(0, 0, it.w, it.h); g.clip();
        it.fn(g, it.w, it.h);
        g.restore();
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }
    }, { key });
    const e = 0.5; // half-texel inset against bleeding
    for (const it of items) T.rect[it.name] = [(it.x + e) / S, 1 - (it.y + it.h - e) / H, (it.x + it.w - e) / S, 1 - (it.y + e) / H];
    return t;
  };
  T.signAtlas = pack(ATL.sign, 'crossing.signAtlas', false);
  T.roadAtlas = pack(ATL.road, 'crossing.roadAtlas', true);

  return T;
}
