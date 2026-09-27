// W4 — こもれび書店 KOMOREBI BOOKS (small 2-storey bookstore with a 看板建築 false front).
// Lot-local: +z = street (east), +x = north. Sliding glass doors (one slid open, enterable), outdoor
// magazine rack, rotating postcard stand, 本日発売 stand sign, shelves of book spines, manga poster.
import * as THREE from 'three';
import { buildBooksInterior } from './intBooks.js';

const GREEN = '#3f5f4f', CREAM = '#f4efe4', INK = '#3a3346', TAN = '#e3d4b8';

function paintBookcase(g, w, h, rows, rr, o = {}) {
  const rh = h / rows;
  g.fillStyle = o.back ?? '#5e4636'; g.fillRect(0, 0, w, h);
  const pal = o.pal ?? ['#8c3a45', '#3f5f4f', '#2f4f7a', '#e9e2d0', '#c9a060', '#5a4032', '#d9718f', '#6f8455', '#e3d4b8', '#4a4f58', '#b86a3a', '#9aa9c9', '#f2c230', '#7a5a8a'];
  for (let r = 0; r < rows; r++) {
    const top = r * rh, bot = (r + 1) * rh - 9;
    g.fillStyle = 'rgba(30,20,30,0.35)'; g.fillRect(0, top, w, 14);
    let x = 2;
    while (x < w - 3) {
      if (rr() < 0.06) { // horizontal stack
        const sw = 30 + rr() * 20; let y = bot;
        for (let i = 0; i < 3 + rr.int(0, 3); i++) { const bh = 6 + rr() * 5; g.fillStyle = rr.pick(pal); g.fillRect(x, y - bh, sw - rr() * 8, bh - 1); y -= bh; }
        x += sw + 2; continue;
      }
      if (rr() < 0.03) { x += 10 + rr() * 16; continue; } // gap
      const bw = 7 + rr() * 13, bh = rh * (0.52 + rr() * 0.38);
      const c = rr.pick(pal);
      g.fillStyle = c; g.fillRect(x, bot - bh, bw, bh);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, bot - bh, 2, bh);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + bw - 1.5, bot - bh, 1.5, bh);
      if (rr() < 0.7) { g.fillStyle = rr() < 0.5 ? 'rgba(255,250,235,0.75)' : 'rgba(40,30,40,0.45)'; g.fillRect(x + bw * 0.25, bot - bh * 0.82, bw * 0.5, bh * 0.4); }
      if (rr() < 0.5) { g.fillStyle = 'rgba(240,210,120,0.8)'; g.fillRect(x + 1, bot - bh * 0.18, bw - 2, 2); }
      x += bw + 0.6;
    }
    g.fillStyle = o.shelf ?? '#8a6446'; g.fillRect(0, bot, w, 9);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, bot, w, 2);
  }
}

export function buildBooks(ctx, C) {
  const { M, P, U, A, F, T } = C;
  const tex = ctx.tex;
  const S = C.space('W4');
  const k = S.k;
  const rr = ctx.rng('shopsA.books');
  const FY = 0.2, F2 = 3.1, E = 5.8, TOPF = 6.9;
  const X0 = -4.0, X1 = 4.0, ZB = -12.2, ZF = -2.3, WT = 0.2;
  const mFac = M.wall(TAN), mSide = M.wall('#e6dcc8'), mTrim = M.wood('#5e4636'), mTrimL = M.t('#f1ead9');
  const mIn = M.inner('#efe6d2', 0.3);
  const glass = M.glass({ opacity: 0.2 });

  // bookcase textures (tiling: 1.2 m x 1.8 m, 6 shelves)
  const tBookA = tex.draw(512, 768, (g, w, h) => paintBookcase(g, w, h, 6, ctx.rng('bk.A')), { key: 'shopsA.bookA', repeat: [1, 1] });
  const tBookB = tex.draw(512, 768, (g, w, h) => paintBookcase(g, w, h, 6, ctx.rng('bk.B'), { pal: ['#f2b5c8', '#9fc3e8', '#f2c230', '#e8506a', '#7cc576', '#f4efe4', '#8e7cc3', '#f08a4b', '#58a8d8', '#3a3346', '#e9e2d0'] }), { key: 'shopsA.bookB', repeat: [1, 1] });
  const caseGeo = (w, h) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.2, uv.getY(i) * h / 1.8); return g; };

  // ---------------- ground + foundation
  C.pave(S, -4.25, 4.25, ZF, 0, M.concrete('#cbc8c0'), { uv: 2 });
  C.pave(S, -4.25, 4.25, -14, ZB, M.concrete('#c4c1b8'), { uv: 2 });
  C.pave(S, X1, 4.25, ZB, ZF, M.concrete('#c4c1b8'), { uv: 2 });
  C.pave(S, -4.25, X0, ZB, ZF, M.concrete('#c4c1b8'), { uv: 2 });
  C.plinth(S, X0 - 0.03, X1 + 0.03, ZB - 0.03, ZF + 0.03, FY, M.concrete('#b3afa5'), 1);
  // entrance sill step
  S.ubox(2.6, FY - (S.gy(-0.1, -2.1) - 0.15), 0.3, M.concrete('#bdb9b0'), [-0.1, (FY + S.gy(-0.1, -2.1) - 0.15) / 2, ZF + 0.14], null, 2);

  // ---------------- shell
  S.ubox(X1 - X0, E - FY, WT, mSide, [0, (FY + E) / 2, ZB + WT / 2], null, 2.5);
  for (const [x, ops] of [[X0 + WT / 2, [[-7.6, -6.4, 4.1, 5.2]]], [X1 - WT / 2, [[-9.0, -8.0, 4.1, 5.2], [-6.0, -5.0, FY + 1.4, FY + 2.3]]]]) {
    for (const [y0, y1] of [[FY, F2], [F2, E]]) {
      const o2 = ops.filter(o => o[2] >= y0 && o[3] <= y1).sort((a, b) => a[0] - b[0]);
      let z = ZB;
      const put = (a, b, ya, yb) => { if (b - a > 1e-3 && yb - ya > 1e-3) S.ubox(WT, yb - ya, b - a, mSide, [x, (ya + yb) / 2, (a + b) / 2], null, 2.5); };
      for (const o of o2) { put(z, o[0], y0, y1); put(o[0], o[1], y0, o[2]); put(o[0], o[1], o[3], y1); z = o[1]; }
      put(z, ZF, y0, y1);
    }
  }
  P.window(S, X0 + 0.1, 4.1, -7.0, 1.2, 1.1, { rotY: -Math.PI / 2, frameMat: mTrimL, glass: M.glass({ frost: true }) });
  P.window(S, X1 - 0.1, 4.1, -8.5, 1.0, 1.1, { rotY: Math.PI / 2, frameMat: mTrimL, glass: M.glass({ frost: true }) });
  P.window(S, X1 - 0.1, FY + 1.4, -5.5, 1.0, 0.9, { rotY: Math.PI / 2, frameMat: mTrimL, glass });
  // false front (看板建築): the front wall rises above the roof with a stepped parapet
  const fz = ZF - WT / 2;
  const seg = (x0, x1, y0, y1, m = mFac) => S.ubox(x1 - x0, y1 - y0, WT + 0.04, m, [(x0 + x1) / 2, (y0 + y1) / 2, fz + 0.02], null, 2.5);
  const DW0 = -3.7, DW1 = -1.5, EW0 = 1.35, EW1 = 3.7, WY0 = FY + 0.55, WY1 = FY + 2.35;
  const D0 = -1.3, D1 = 1.1, DH = FY + 2.2, TRT = FY + 2.72;
  seg(X0, DW0, FY, F2); seg(DW1, D0, FY, F2); seg(D1, EW0, FY, F2); seg(EW1, X1, FY, F2);
  seg(DW0, DW1, FY, WY0, M.wood('#7d5c45')); seg(EW0, EW1, FY, WY0, M.wood('#7d5c45'));
  seg(DW0, DW1, WY1, F2); seg(EW0, EW1, WY1, F2); seg(D0, D1, TRT, F2);
  const up = [[-3.2, -1.8], [-0.7, 0.7], [1.8, 3.2]], UY0 = 4.2, UY1 = 5.4;
  { let x = X0; for (const [a, b] of up) { seg(x, a, F2, TOPF); seg(a, b, F2, UY0); seg(a, b, UY1, TOPF); x = b; } seg(x, X1, F2, TOPF); }
  // cornice + central pediment step + emblem
  k.box(X1 - X0 + 0.24, 0.14, 0.34, mTrimL, [0, 6.2, ZF + 0.06]);
  k.box(X1 - X0 + 0.14, 0.08, 0.28, mTrimL, [0, 6.35, ZF + 0.03]);
  k.box(X1 - X0 + 0.2, 0.1, 0.3, mTrimL, [0, TOPF + 0.02, ZF - 0.08]);
  S.ubox(2.6, 0.5, WT + 0.04, mFac, [0, TOPF + 0.25, fz + 0.02], null, 2.5);
  k.box(2.8, 0.1, 0.3, mTrimL, [0, TOPF + 0.52, ZF - 0.08]);
  const rEmb = A.lit.region(128, 128, (g, w, h) => {
    g.fillStyle = GREEN; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill();
    g.strokeStyle = '#e7c98a'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 54, 0, 6.3); g.stroke();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; g.fillStyle = i % 2 ? '#a7c48b' : '#86ad68'; g.beginPath(); g.ellipse(64 + Math.cos(a) * 20, 60 + Math.sin(a) * 20, 18, 9, a, 0, 6.3); g.fill(); }
    g.fillStyle = '#e7c98a'; g.fillRect(61, 64, 6, 36);
    U.sun(g, 64, 40, 7, '#f6e3a0', false);
  });
  S.card(rEmb, 0.5, 0.5, [0, TOPF + 0.1, ZF + 0.03]);
  // belt / canopy fascia band + vertical pilasters
  for (const x of [X0 + 0.1, X1 - 0.1]) k.box(0.24, TOPF - F2, 0.08, mTrimL, [x, (F2 + TOPF) / 2, ZF + 0.03]);
  k.box(X1 - X0, 0.12, 0.08, mTrimL, [0, 4.0, ZF + 0.03]);
  // roof behind the false front (low gable, ridge along z) + gutters
  {
    const pitch = 0.25, half = (X1 - X0) / 2 + 0.3, ridgeY = E + (X1 - X0) / 2 * pitch, eaveY = E - 0.3 * pitch;
    const len = Math.hypot(half, half * pitch), ang = Math.atan(pitch), RL = ZF - ZB + 0.3;
    const zc = (ZB - 0.3 + ZF) / 2;
    for (const s of [1, -1]) {
      const g = new THREE.Group(); g.position.set(s * half / 2 + s * Math.sin(ang) * 0.05, (ridgeY + eaveY) / 2 + Math.cos(ang) * 0.05, zc); g.rotation.set(0, 0, -s * ang); S.g.add(g);
      ctx.kit(g).mesh(C.uvBox(RL, 0.1, len, 1.2), M.roofTile('#5a6470'), [0, 0, 0], [0, Math.PI / 2, 0]);
      k.cyl(0.06, 0.06, RL, M.t('#9aa1a8'), [s * (half + 0.04), eaveY - 0.07, zc], [Math.PI / 2, 0, 0], 8);
    }
    k.mesh(ctx.geo.extrude([[X0, 0], [X1, 0], [0, ridgeY - E]], WT), mSide, [0, E, ZB + WT / 2]);
    k.box(0.2, 0.1, RL, M.t('#4a5058'), [0, ridgeY + 0.08, zc]);
    P.downpipe(S, X0 - 0.07, ZB + 0.3, eaveY - 0.1, M.t('#9aa1a8'), [1, 0]);
    P.downpipe(S, X1 + 0.07, ZB + 0.3, eaveY - 0.1, M.t('#9aa1a8'), [-1, 0]);
  }

  // ---------------- glazing: display windows, sliding doors (one open), transoms, upper windows
  const fw = (x0, x1, y0, y1, o = {}) => P.window(S, (x0 + x1) / 2, y0, ZF - 0.1, x1 - x0, y1 - y0, { frameMat: mTrim, fd: 0.1, ft: 0.06, glass, ...o });
  fw(DW0, DW1, WY0, WY1, { cols: 2, sillD: 0.06 });
  fw(EW0, EW1, WY0, WY1, { cols: 2, sillD: 0.06 });
  fw(D0, D1, DH + 0.06, TRT - 0.02, { cols: 3, sill: false, ft: 0.05 });
  fw(DW0, DW1, WY1 + 0.06, F2 - 0.3, { cols: 3, sill: false, ft: 0.05 });
  fw(EW0, EW1, WY1 + 0.06, F2 - 0.3, { cols: 3, sill: false, ft: 0.05 });
  {
    k.box(0.08, DH - FY, 0.14, mTrim, [D0 - 0.04, (FY + DH) / 2, fz]);
    k.box(0.08, DH - FY, 0.14, mTrim, [D1 + 0.04, (FY + DH) / 2, fz]);
    k.box(D1 - D0 + 0.16, 0.08, 0.14, mTrim, [(D0 + D1) / 2, DH + 0.04, fz]);
    k.box(D1 - D0, 0.03, 0.12, M.t('#9aa1a8'), [(D0 + D1) / 2, FY + 0.015, fz]);
    const pw = (D1 - D0) / 2;
    const panel = (cx, z) => {
      const g = S.k.group([cx, FY + 0.03, z]); const kk = ctx.kit(g);
      for (const x of [-pw / 2 + 0.035, pw / 2 - 0.035]) kk.box(0.07, DH - FY - 0.05, 0.045, mTrim, [x, (DH - FY - 0.05) / 2, 0]);
      kk.box(pw, 0.07, 0.045, mTrim, [0, DH - FY - 0.08, 0]); kk.box(pw, 0.2, 0.045, mTrim, [0, 0.1, 0]); kk.box(pw, 0.05, 0.045, mTrim, [0, 1.0, 0]);
      kk.plane(pw - 0.14, DH - FY - 0.35, glass, [0, (DH - FY) / 2 + 0.08, 0]).castShadow = false;
      kk.box(0.03, 0.14, 0.03, M.t('#c8a04a'), [-pw / 2 + 0.1, 1.0, 0.035]);
    };
    panel(D1 - pw / 2, fz - 0.03);            // fixed right leaf
    panel(D1 - pw / 2 - 0.12, fz + 0.03);     // left leaf slid open (outer track)
    const rHours = A.lit.region(128, 96, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = GREEN; g.fillRect(0, 0, w, 24); U.text(g, '営業時間', w / 2, 13, 15, F.sans, CREAM, { weight: 700 }); U.text(g, '10:00 〜 20:00', w / 2, 46, 17, F.en, INK, { weight: 700 }); U.text(g, '定休日 木曜', w / 2, 74, 15, F.sans, INK, { weight: 700 }); });
    S.card(rHours, 0.22, 0.165, [0.55, FY + 1.4, fz + 0.06]);
  }
  const rCur = A.lit.region(128, 128, (g, w, h) => { g.fillStyle = '#e9e2d0'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,100,90,0.22)'; for (let y = 0; y < h * 0.55; y += 6) g.fillRect(0, y, w, 2); g.fillStyle = '#6d6478'; g.fillRect(0, h * 0.55, w, h * 0.45); g.fillStyle = 'rgba(255,238,210,0.45)'; g.fillRect(w * 0.55, h * 0.62, w * 0.3, h * 0.38); g.fillStyle = '#6f9a5a'; g.beginPath(); g.arc(w * 0.25, h * 0.95, 14, Math.PI, 0); g.fill(); });
  for (const [a, b] of up) fw(a, b, UY0, UY1, { frameMat: mTrimL, cols: 2, back: rCur, backZ: 0.14, sillD: 0.1 });

  // ---------------- canopy (庇) + sign band + vertical 本 sign
  {
    const mC = M.t('#4d6457');
    const cy = 2.72, cd = 0.85;
    k.box(X1 - X0 + 0.2, 0.06, cd, mC, [0, cy, ZF + cd / 2], [0.06, 0, 0]);
    k.box(X1 - X0 + 0.2, 0.2, 0.04, mC, [0, cy - 0.1, ZF + cd]);
    const rFas = A.lit.region(1024, 26, (g, w, h) => { g.fillStyle = '#4d6457'; g.fillRect(0, 0, w, h); U.text(g, '本 · 雑誌 · コミック · 文庫 · 参考書 · 文具 · 絵本 · ご注文承ります', w / 2, h / 2 + 1, 17, F.sans, CREAM, { weight: 700, maxW: w - 20 }); }, { bg: '#4d6457' });
    S.card(rFas, X1 - X0, 0.16, [0, cy - 0.1, ZF + cd + 0.022]);
    for (const x of [-2.5, 0, 2.5]) k.box(0.03, 0.03, cd * 1.05, M.t('#3f3d45'), [x, cy + 0.14, ZF + cd / 2], [-0.3, 0, 0]);
    for (const x of [-2.0, 2.0]) k.cyl(0.07, 0.07, 0.01, M.glow('#fff1d8', 1.2), [x, cy - 0.04, ZF + 0.5], null, 10);
    // sign band
    const rSign = A.lit.region(900, 110, (g, w, h) => {
      g.fillStyle = '#f6efdc'; g.fillRect(0, 0, w, h);
      g.strokeStyle = GREEN; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      // komorebi: sunlight through leaves
      for (let i = 0; i < 7; i++) { const a = i * 0.9; g.fillStyle = i % 2 ? '#86ad68' : '#6f9a5a'; g.beginPath(); g.ellipse(70 + Math.cos(a) * 26, 52 + Math.sin(a) * 18, 18, 9, a, 0, 6.3); g.fill(); }
      U.sun(g, 70, 52, 10, '#f2c230', true);
      U.text(g, 'こもれび書店', w * 0.5, h * 0.45, 64, F.serif, GREEN, { weight: 700 });
      U.text(g, 'KOMOREBI BOOKS · since 1962', w * 0.5, h * 0.83, 17, F.en, '#8a6446', { weight: 700 });
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + 1; g.fillStyle = i % 2 ? '#86ad68' : '#6f9a5a'; g.beginPath(); g.ellipse(w - 70 + Math.cos(a) * 26, 52 + Math.sin(a) * 18, 18, 9, a, 0, 6.3); g.fill(); }
      U.sun(g, w - 70, 52, 8, '#f2c230', true);
    });
    k.box(X1 - X0 - 0.2, 0.86, 0.08, mTrim, [0, 3.5, ZF + 0.07]);
    S.card(rSign, X1 - X0 - 0.36, 0.72, [0, 3.5, ZF + 0.113]);
    // vertical lit projecting sign
    const rV = A.glow.region(96, 400, (g, w, h) => {
      g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h); g.fillStyle = GREEN; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.fillStyle = '#d9463b'; g.beginPath(); g.arc(w / 2, 62, 40, 0, 6.3); g.fill(); U.text(g, '本', w / 2, 64, 56, F.serif, '#fbf8f0', { weight: 700 });
      U.vtext(g, 'こもれび書店', w / 2, 118, 42, F.serif, GREEN, 700, 1.02);
    });
    const vx = X1 + 0.04, vz = ZF + 0.42, vy = 4.9;
    k.box(0.16, 1.9, 0.48, M.t('#e8e4d8'), [vx, vy, vz]);
    S.card(rV, 0.42, 1.8, [vx + 0.082, vy, vz], [0, Math.PI / 2, 0]);
    S.card(rV, 0.42, 1.8, [vx - 0.082, vy, vz], [0, -Math.PI / 2, 0]);
    for (const y of [vy + 0.8, vy - 0.8]) k.box(0.05, 0.05, 0.3, M.t('#6d747c'), [vx, y, ZF + 0.12]);
  }

  // ---------------- outdoor: magazine rack, postcard stand, 本日発売 sign, plant
  const covTitles = [['週刊', '少年ソラ', '#e8506a'], ['週刊', 'はるかぜ', '#58a8d8'], ['月刊', 'ねこびより', '#f2b53b'], ['月刊', 'コミックさくら', '#f28db2'], ['週刊', 'まちかど', '#e36b5d'], ['月刊', '鉄道のたび', '#3f7fb5'], ['週刊', 'ゲーム通信', '#8e7cc3'], ['月刊', 'おうちごはん', '#e9a23b'], ['週刊', 'テレビ桜', '#5a9e58'], ['月刊', 'ガーデン', '#6f8455'], ['月刊', 'カメラ散歩', '#4a4f58'], ['週刊', 'ヤング桜', '#dd7f9d']];
  const covers = covTitles.map(([kind, t, c], i) => A.lit.region(92, 128, (g, w, h) => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h);
    const r2 = ctx.rng('cov' + i);
    // cover art
    g.fillStyle = c; g.globalAlpha = 0.25; g.fillRect(0, 30, w, h - 30); g.globalAlpha = 1;
    if (i % 3 === 0) { // character bust
      g.fillStyle = '#3f4a6a'; g.beginPath(); g.arc(w / 2, 70, 24, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 24, 70, 48, 26);
      g.fillStyle = '#f7dcc8'; g.beginPath(); g.arc(w / 2, 76, 17, 0, 6.3); g.fill();
      g.fillStyle = '#3f4a6a'; g.fillRect(w / 2 - 17, 60, 34, 8);
      g.fillStyle = '#2f64b5'; g.fillRect(w / 2 - 8, 76, 4, 5); g.fillRect(w / 2 + 4, 76, 4, 5);
      g.fillStyle = '#f4f1e8'; g.beginPath(); g.moveTo(w / 2 - 26, 110); g.lineTo(w / 2, 96); g.lineTo(w / 2 + 26, 110); g.lineTo(w / 2 + 26, h); g.lineTo(w / 2 - 26, h); g.fill();
      g.fillStyle = c; g.fillRect(w / 2 - 5, 100, 10, 8);
    } else if (i % 3 === 1) { // object / scene
      g.fillStyle = r2.pick(['#f2b5c8', '#9fc3e8', '#f6e3a0']); g.beginPath(); g.arc(w / 2, 78, 26, 0, 6.3); g.fill();
      g.fillStyle = c; g.fillRect(w / 2 - 20, 82, 40, 20); U.sakura(g, w / 2 + 16, 60, 9, '#f2b5c8', '#f6e3a0');
    } else { // cat / food
      g.fillStyle = '#e9a23b'; g.beginPath(); g.ellipse(w / 2, 86, 24, 18, 0, 0, 6.3); g.fill();
      g.beginPath(); g.moveTo(w / 2 - 20, 76); g.lineTo(w / 2 - 14, 58); g.lineTo(w / 2 - 6, 72); g.fill(); g.beginPath(); g.moveTo(w / 2 + 20, 76); g.lineTo(w / 2 + 14, 58); g.lineTo(w / 2 + 6, 72); g.fill();
      g.fillStyle = INK; g.fillRect(w / 2 - 10, 82, 4, 4); g.fillRect(w / 2 + 6, 82, 4, 4);
    }
    g.fillStyle = c; g.fillRect(0, 0, w, 30);
    U.text(g, kind, 14, 15, 11, F.sans, c, { weight: 900 });
    g.fillStyle = '#fbf8f0'; g.fillRect(2, 3, 24, 24); U.text(g, kind, 14, 15, 11, F.sans, c, { weight: 900 });
    U.text(g, t, w / 2 + 12, 15, 15, F.sans, '#fbf8f0', { weight: 900, maxW: w - 32 });
    g.fillStyle = INK; g.fillRect(6, h - 20, w * 0.5, 3); g.fillRect(6, h - 13, w * 0.35, 3);
    U.text(g, '¥' + (380 + (i % 4) * 110), w - 20, h - 11, 11, F.en, INK, { weight: 700 });
  }, { bg: '#fbf8f0' }));
  // magazine rack
  {
    const x0 = 1.45, x1 = 3.6, z = -1.95, cx = (x0 + x1) / 2, w = x1 - x0;
    const mR = M.t('#e8e6df'), mRd = M.t('#b9bcc0');
    for (const x of [x0, x1]) { k.box(0.04, 1.2, 0.5, mR, [x, S.gy(x, z) + 0.6, z]); }
    k.box(w, 0.06, 0.5, mRd, [cx, S.gy(cx, z) + 0.12, z]);
    for (let t = 0; t < 3; t++) {
      const y = S.gy(cx, z) + 0.34 + t * 0.3, zz = z + 0.14 - t * 0.11;
      k.box(w, 0.02, 0.14, mRd, [cx, y, zz], [0.3, 0, 0]);
      k.box(w, 0.035, 0.01, mR, [cx, y + 0.02, zz + 0.07]);
      const n = Math.floor(w / 0.235);
      for (let i = 0; i < n; i++) S.card(covers[(i + t * 4) % covers.length], 0.215, 0.3, [x0 + 0.12 + i * (w - 0.04) / n, y + 0.15, zz - 0.02], [-0.3, 0, 0]);
    }
    k.box(w, 0.9, 0.03, mRd, [cx, S.gy(cx, z) + 0.9, z - 0.24]);
    const rHead = A.lit.region(256, 40, (g, w2, h2) => { g.fillStyle = GREEN; g.fillRect(0, 0, w2, h2); U.text(g, '週刊誌 · 月刊誌', w2 / 2, h2 / 2 + 1, 24, F.sans, CREAM, { weight: 900 }); });
    k.box(w, 0.18, 0.03, M.t(GREEN), [cx, S.gy(cx, z) + 1.3, z - 0.22]);
    S.card(rHead, w - 0.1, 0.15, [cx, S.gy(cx, z) + 1.3, z - 0.203]);
    S.box(cx, z, w + 0.05, 0.55, -1, 1.4);
  }
  // rotating postcard stand
  {
    const x = 3.75, z = -0.75, y = S.gy(x, z);
    const pcs = ['#bcd6ea', '#f7d3de', '#f1e3cf', '#cfe0c8', '#f6e3a0', '#c9b8e8', '#bfe3f4', '#f2b5c8'].map((bg, i) => A.lit.region(64, 92, (g, w, h) => {
      g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = bg; g.fillRect(4, 4, w - 8, h - 22);
      if (i % 4 === 0) { g.fillStyle = '#f5f0e6'; g.fillRect(8, 44, 48, 16); g.fillStyle = '#ef9fbe'; g.fillRect(8, 52, 48, 3); g.fillStyle = '#6a5048'; g.fillRect(40, 20, 3, 24); U.sakura(g, 42, 20, 10, '#f2b5c8'); }
      else if (i % 4 === 1) { g.fillStyle = '#3a3346'; g.beginPath(); g.ellipse(32, 52, 14, 10, 0, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(22, 46); g.lineTo(24, 34); g.lineTo(30, 44); g.fill(); g.beginPath(); g.moveTo(42, 46); g.lineTo(40, 34); g.lineTo(34, 44); g.fill(); }
      else if (i % 4 === 2) { g.fillStyle = '#e9a23b'; g.beginPath(); g.arc(32, 44, 12, 0, 6.3); g.fill(); g.fillStyle = '#7fa6c9'; g.fillRect(4, 50, w - 8, 20); }
      else { for (let j = 0; j < 6; j++) U.sakura(g, 12 + (j * 17) % 44, 16 + (j * 23) % 48, 7, '#eb9db6', '#f6e3a0'); }
      U.text(g, ['桜ヶ丘', 'ねこ', '夕焼け', '春'][i % 4], w / 2, h - 9, 11, F.sans, INK, { weight: 700 });
    }));
    k.cyl(0.25, 0.28, 0.05, M.t('#6d747c'), [x, y + 0.025, z], null, 14);
    k.cyl(0.02, 0.02, 1.7, M.t('#9aa1a8'), [x, y + 0.87, z], null, 6);
    const sg = S.k.group([x, y, z], 0.35); const ks = ctx.kit(sg);
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2; const nx = Math.sin(a), nz = Math.cos(a);
      ks.box(0.34, 1.02, 0.01, M.t('#c9ced3'), [nx * 0.09, 1.02, nz * 0.09], [0, a, 0]);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const reg = pcs[(s * 3 + r * 5 + c) % pcs.length];
        const lx = (c - 1) * 0.11, py = 0.62 + r * 0.25;
        S.card(reg, 0.095, 0.137, [nx * 0.1 + Math.cos(a) * lx, py + 0.02, nz * 0.1 - Math.sin(a) * lx], [-0.06, a, 0], null, ks);
        ks.box(0.1, 0.01, 0.03, M.t('#9aa1a8'), [nx * 0.11 + Math.cos(a) * lx, py - 0.06, nz * 0.11 - Math.sin(a) * lx], [0, a, 0]);
      }
    }
    ks.box(0.26, 0.1, 0.26, M.t(GREEN), [0, 1.82, 0]);
    S.cyl(x, z, 0.3, -1, 1.9);
  }
  // 本日発売 stand sign
  {
    const rNew = A.lit.region(200, 360, (g, w, h) => {
      g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d9463b'; g.fillRect(0, 0, w, 120);
      U.vtext(g, '本日', w * 0.7, 10, 48, F.sans, '#fff', 900, 1.0);
      U.vtext(g, '発売', w * 0.3, 10, 48, F.sans, '#fff', 900, 1.0);
      g.fillStyle = '#f2c230'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 28 : 38; g.lineTo(w / 2 + Math.cos(a) * r, 170 + Math.sin(a) * r); } g.closePath(); g.fill();
      U.text(g, 'NEW', w / 2, 171, 22, F.en, '#d9463b', { weight: 900 });
      U.text(g, '週刊少年ソラ', w / 2, 234, 24, F.sans, INK, { weight: 900 });
      U.text(g, '21号', w / 2, 262, 22, F.sans, '#d9463b', { weight: 900 });
      g.fillStyle = GREEN; g.fillRect(12, 286, w - 24, 2);
      U.text(g, 'コミックス新刊', w / 2, 310, 20, F.sans, INK, { weight: 700 });
      U.text(g, '入荷しました!', w / 2, 338, 20, F.sans, INK, { weight: 700 });
    });
    const sx = 0.55, sz = -0.95;
    P.standSign(S, sx, S.gy(sx, sz), sz, 0.1, rNew, { w: 0.46, h: 0.84, frame: '#e8e6df' });
    S.box(sx, sz, 0.5, 0.35, -1, 1.0, 0.1);
  }
  P.pot(S, -1.42, S.gy(-1.42, -1.95), -1.95, { r: 0.13, h: 0.26, color: '#c7805d', plant: 'flowers', flowers: ['#f2c230', '#fbf8f2'], n: 10 });
  S.cyl(-1.42, -1.95, 0.15, -1, 0.6);

  // ---------------- interior: shell skins here, modelled contents in intBooks.js
  const IX0 = X0 + WT, IX1 = X1 - WT, IZ0 = ZB + WT, IZ1 = ZF - WT;
  const CI = F2 - 0.12;
  { const fl = k.mesh(C.uvPlane(IX1 - IX0, IZ1 - IZ0, 1.6), M.innerMap('#9c7454', T.planks, 0.22), [0, FY + 0.004, (IZ0 + IZ1) / 2], [-Math.PI / 2, 0, 0]); fl.castShadow = false; }
  k.plane(IX1 - IX0, IZ1 - IZ0, M.inner('#f1ead9', 0.3), [0, CI, (IZ0 + IZ1) / 2], [Math.PI / 2, 0, 0]);
  k.plane(IX1 - IX0, CI - FY, mIn, [0, (FY + CI) / 2, IZ0 + 0.005]);
  k.plane(IZ1 - IZ0, CI - FY, mIn, [IX0 + 0.005, (FY + CI) / 2, (IZ0 + IZ1) / 2], [0, Math.PI / 2, 0]);
  k.plane(IZ1 - IZ0, CI - FY, mIn, [IX1 - 0.005, (FY + CI) / 2, (IZ0 + IZ1) / 2], [0, -Math.PI / 2, 0]);
  buildBooksInterior(ctx, C, S, { FY, CI, IX0, IX1, IZ0, IZ1, DW0, DW1, EW0, EW1, ZF });

  // ---------------- side + back services
  {
    P.acUnit(S, X1 + 0.19, S.gy(X1 + 0.2, -10.5) + 0.02, -10.5, Math.PI / 2, { ductH: 1.2 });
    S.box(X1 + 0.19, -10.5, 0.32, 0.9, -1, 0.8);
    P.meter(S, X1, 1.6, -11.4, Math.PI / 2);
    P.gasMeter(S, X1, 1.1, -9.3, Math.PI / 2);
    P.pipe(S, X1 + 0.05, -9.5, S.gy(X1, -9.5), 5.6, 0.03);
    P.backDoor(S, 2.0, FY, ZB, Math.PI, '#8e9aa0');
    const bst = FY - 0.12, bsb = S.gy(2.0, -12.5) - 0.2;
    S.ubox(1.2, bst - bsb, 0.45, M.concrete('#c4c2bb'), [2.0, (bst + bsb) / 2, ZB - 0.22], null, 2);
    S.walk(2.0, ZB - 0.22, 1.2, 0.45, bst);
    // bundled old magazines + cartons of returns at the back door
    for (let i = 0; i < 3; i++) { const y = S.gy(0.6, -12.6) + i * 0.2; k.box(0.3, 0.2, 0.42, M.t(rr.pick(['#e9e2d0', '#d8d0bf', '#e3d8c4'])), [0.6 + (i % 2) * 0.03, y + 0.1, -12.6], [0, 0.1 * i, 0]); }
    ctx.wires.add([S.world(0.45, S.gy(0.6, -12.6) + 0.62, -12.6), S.world(0.75, S.gy(0.6, -12.6) + 0.62, -12.6)], { width: 0.01, color: '#c9a57a' });
    P.carton(S, -0.2, S.gy(-0.2, -12.7), -12.7, 0.6, 0.4, 0.45, 0.1);
    P.carton(S, -0.25, S.gy(-0.2, -12.7) + 0.4, -12.7, 0.5, 0.3, 0.4, -0.15, '#d4b286');
    P.crate(S, -1.0, S.gy(-1.0, -12.6), -12.6, 0.2, '#4f8fc0');
    S.box(0.1, -12.65, 2.4, 0.6, -1, 0.8);
    P.acUnit(S, -2.2, S.gy(-2.2, -12.6), ZB - 0.22, Math.PI, { ductH: 2.2 });
    S.box(-2.2, ZB - 0.22, 0.9, 0.36, -1, 0.8);
  }

  // ---------------- physics: shell
  S.box(0, ZB + WT / 2, X1 - X0, WT, -1, E);
  S.box(X0 + WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, E);
  S.box(X1 - WT / 2, (ZB + ZF) / 2, WT, ZF - ZB, -1, E);
  const openX0 = D0, openX1 = D0 + (D1 - D0) / 2 - 0.12 - (D1 - D0) / 2 * 0 ; // left leaf slid → opening D0..(D1 - pw - 0.12 ... ) approx
  void openX1;
  S.box((X0 + openX0) / 2, ZF - WT / 2, openX0 - X0, WT + 0.1, -1, TOPF);
  S.box((-0.24 + X1) / 2, ZF - WT / 2, X1 + 0.24, WT + 0.1, -1, TOPF);
  S.box((D0 + D1) / 2, ZF - WT / 2, D1 - D0, WT, DH, TOPF);
  S.walk(0, (ZB + ZF) / 2, X1 - X0, ZF - ZB, FY);

  return { S };
}
