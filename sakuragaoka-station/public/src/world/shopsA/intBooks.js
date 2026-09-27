// W4 こもれび書店 — interior, modelled: wall bookcases + double-sided islands filled with individual
// instanced books (varied thickness / height / depth / colour, series runs, flat stacks, leaning books;
// only the spines are printed), manga section, face-out end caps, flat display tables with stacked books,
// magazine rack under the window, register counter with POS, card reader, bookmark stand, paper covers
// and bags, kick stool, step ladder, ceiling fixtures, window displays.
import * as THREE from 'three';

const GREEN = '#3f5f4f', INK = '#3a3346', CREAM = '#f4efe4';

export function buildBooksInterior(ctx, C, S, D) {
  const { M, A, U, F, T } = C; const G = C.G; const k = S.k;
  const { FY, CI, IX0, IX1, IZ0, IZ1, DW0, DW1, EW0, EW1, ZF } = D;
  G.setShop('W4', 0.42);
  const rr = ctx.rng('bk.int2');
  const white = (r, lo = 0.88) => new THREE.Color().setScalar(lo + r() * (1 - lo));
  const mCase = M.inner('#6b4a37', 0.2, { map: T.wood }), mCaseL = M.inner('#8a6446', 0.25, { map: T.wood }), mBoard = M.inner('#b48a62', 0.28, { map: T.wood });
  const mBack = M.inner('#5a4032', 0.15), mMetal = M.inner('#b8bdc2', 0.28), mInk = M.inner('#3a3346', 0.1), mDark = M.inner('#4f5358', 0.16);

  // ---------------- book filling
  const PAL = ['#e9dfc8', '#c9d8e6', '#e6c9cf', '#cfdcc4', '#e8d49a', '#b9c4d8', '#d8b8a8', '#8c3a45', '#3f5f4f', '#2f4f7a', '#6b4a37', '#6d6478', '#c98a5a', '#e3a0a8', '#9aa9c9', '#f0e6d2', '#a7c48b', '#4a4f58'];
  const TYPES = {
    bunko: { h: [0.148, 0.152], d: 0.105, t: [0.01, 0.022], run: [4, 12], tint: true },
    shinsho: { h: [0.172, 0.175], d: 0.106, t: [0.009, 0.018], run: [5, 10], tint: true },
    tanko: { h: [0.186, 0.215], d: [0.13, 0.15], t: [0.018, 0.04], run: [1, 3], tint: true },
    large: { h: [0.25, 0.3], d: [0.19, 0.22], t: [0.008, 0.028], run: [1, 3], tint: true },
    manga: { h: [0.176, 0.176], d: 0.113, t: [0.013, 0.016], run: [6, 16], manga: true },
    kids: { h: [0.24, 0.27], d: [0.2, 0.24], t: [0.008, 0.014], run: [1, 2], tint: true },
  };
  const rng2 = (v, r) => Array.isArray(v) ? v[0] + r() * (v[1] - v[0]) : v;
  function fillBooks(g, x0, x1, y, zf, maxH, type, r) {
    const Ty = TYPES[type];
    let x = x0 + 0.004;
    while (x < x1 - 0.012) {
      const q = r();
      if (q < 0.03 && type !== 'manga') { // lying stack
        const h = rng2(Ty.h, r), d = rng2(Ty.d, r), n = r.int(3, 6);
        if (x + h > x1) break;
        for (let j = 0; j < n; j++) { const t = rng2(Ty.t, r); G.add('book', g, [x + h, y + j * t * 1.02 + t / 2, zf - d / 2 - 0.004], [t, h, d], r.pick(PAL), [0, (r() - 0.5) * 0.08, Math.PI / 2], r.int(0, 15)); if ((j + 1) * t > maxH - 0.02) break; }
        x += h + 0.012; continue;
      }
      if (q < 0.05) { x += 0.02 + r() * 0.05; continue; }
      const n = r.int(Ty.run[0], Ty.run[1]);
      const h = rng2(Ty.h, r), d = rng2(Ty.d, r);
      const col = Ty.manga ? null : r.pick(PAL), v0 = Ty.manga ? r.int(16, 27) : r.int(0, 15);
      for (let i = 0; i < n; i++) {
        const t = Ty.manga ? rng2(Ty.t, r) : rng2(Ty.t, r);
        if (x + t > x1) break;
        const hh = Ty.run[1] > 4 ? h : rng2(Ty.h, r);
        if (hh > maxH) continue;
        const c = Ty.manga ? white(r, 0.9) : (Ty.run[1] > 4 ? new THREE.Color(col).multiplyScalar(0.94 + r() * 0.06) : new THREE.Color(r.pick(PAL)));
        const v = Ty.manga ? (i % 2 ? v0 : Math.min(27, v0 + 1)) : (Ty.run[1] > 4 ? v0 : r.int(0, 15));
        G.add('book', g, [x + t / 2, y, zf - d / 2 - (r() < 0.12 ? 0.012 : 0.003)], [t, hh, d], c, [0, 0, 0], v);
        x += t + 0.0012;
      }
      if (r() < 0.12 && x < x1 - 0.1) { // a leaning book at the end of a run
        const t = rng2(Ty.t, r), hh = Math.min(maxH - 0.02, rng2(Ty.h, r));
        G.add('book', g, [x + hh * 0.12 + t / 2, y, zf - d / 2 - 0.004], [t, hh, d], r.pick(PAL), [0, 0, 0.12], r.int(0, 15));
        x += hh * 0.14 + t + 0.02;
      }
      x += 0.002;
    }
  }
  function faceOut(g, x0, x1, y, zf, r, h = 0.19, w = 0.13) {
    const n = Math.floor((x1 - x0) / (w + 0.03));
    const sp = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + sp * (i + 0.5), v = r.int(0, 31);
      for (let j = 0; j < 2; j++) G.add('cover', g, [x, y, zf - 0.035 - j * 0.02], [w, h, 0.016], white(r, 0.93), [-0.13, 0, 0], v);
      G.add('slab', g, [x, y, zf - 0.012], [w * 0.7, 0.012, 0.012], '#c9ced3');
    }
  }
  // label printed on header boards
  const headerReg = (t) => A.inner.region(256, 44, (g, w, h) => { g.fillStyle = CREAM; g.fillRect(0, 0, w, h); g.fillStyle = GREEN; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h); U.text(g, t, w / 2, h / 2 + 2, 24, F.serif, GREEN, { weight: 700, maxW: w - 40 }); }, { bg: CREAM });

  /** bookcase: group at (cx, FY, cz) with rotY; local x along the case, local +z = front (aisle). */
  function bookcase(cx, cz, rotY, len, H, n, d, plan, label, o = {}) {
    const g = S.k.group([cx, FY, cz], rotY); const kg = ctx.kit(g);
    if (o.back !== false) kg.box(len, H, 0.015, mBack, [0, H / 2, 0.008]);
    for (const s of [-1, 1]) kg.box(0.025, H, d, mCase, [s * (len / 2 - 0.0125), H / 2, d / 2]);
    kg.box(len + 0.02, 0.03, d + 0.02, mCase, [0, H + 0.015, d / 2]);
    kg.box(len, 0.08, d, mCase, [0, 0.04, d / 2]);
    const bays = Math.max(1, Math.round(len / 0.9)), bw = len / bays;
    for (let b = 1; b < bays; b++) kg.box(0.02, H - 0.08, d - 0.01, mCase, [-len / 2 + b * bw, 0.08 + (H - 0.08) / 2, d / 2]);
    const pitch = (H - 0.08 - 0.03) / n;
    for (let i = 1; i < n; i++) kg.box(len - 0.03, 0.018, d - 0.012, mCaseL, [0, 0.08 + i * pitch - 0.009, d / 2]);
    if (label) { kg.box(Math.min(len, 1.6), 0.14, 0.02, mCase, [0, H + 0.1, d - 0.02]); S.card(headerReg(label), Math.min(len, 1.6) - 0.06, 0.11, [0, H + 0.1, d - 0.008], null, null, kg); }
    const r = ctx.rng(`bk.case|${cx.toFixed(2)}|${cz.toFixed(2)}|${rotY.toFixed(2)}`);
    for (let b = 0; b < bays; b++) for (let i = 0; i < n; i++) {
      const x0 = -len / 2 + b * bw + 0.02, x1 = -len / 2 + (b + 1) * bw - 0.012;
      const y = 0.08 + i * pitch + (i ? 0.0 : 0);
      const ty = typeof plan === 'function' ? plan(b, i, r) : plan;
      if (ty === 'face') faceOut(g, x0, x1, y, d - 0.01, r);
      else fillBooks(g, x0, x1, y, d - 0.008, pitch - 0.03, ty, r);
    }
    return g;
  }

  // ---------------- ceiling fixtures (housing + diffuser) and soft pools on the floor
  {
    const mFix = M.inner('#f1ead9', 0.42), mLamp = M.glow('#fff0d6', 1.2);
    const pool = poolMat(ctx, C);
    for (const z of [-4.2, -6.4, -8.6, -10.8]) for (const x of [-1.9, 1.9]) {
      k.box(1.3, 0.06, 0.3, mFix, [x, CI - 0.03, z]);
      k.box(1.2, 0.02, 0.22, mLamp, [x, CI - 0.066, z]);
      const p = k.plane(2.4, 1.5, pool, [x, FY + 0.012, z], [-Math.PI / 2, 0, 0]); p.receiveShadow = false; ctx.noOutline(p);
    }
  }

  // ---------------- wall bookcases
  const H = 2.05, NS = 6, DP = 0.33;
  // south wall (faces +x): novels / bunko / essays
  bookcase(IX0 + 0.005 + DP / 2 - DP / 2, (-11.62 + -3.2) / 2, Math.PI / 2, -3.2 - -11.62, H, NS, DP,
    (b, i, r) => i === 0 ? 'large' : b < 3 ? (i < 4 ? 'bunko' : 'shinsho') : b < 6 ? (i === 3 ? 'face' : 'tanko') : (i < 3 ? 'tanko' : 'bunko'), null);
  // north wall (faces -x), split around the window
  bookcase(IX1 - 0.005, (-11.62 + -6.35) / 2, -Math.PI / 2, -6.35 - -11.62, H, NS, DP, (b, i) => i === 0 ? 'kids' : b === 2 && i === 3 ? 'face' : i < 3 ? 'large' : 'tanko', null);
  bookcase(IX1 - 0.005, (-4.95 + -3.2) / 2, -Math.PI / 2, -3.2 - -4.95, H, NS, DP, (b, i) => i === 2 ? 'face' : 'tanko', null);
  // back wall (faces +z): manga section left, reference right
  bookcase((IX0 + 0.0 + -0.62) / 2 - 0.0 + 0.17, IZ0 + 0.005, 0, -0.62 - (IX0 + 0.34), H, NS, DP, (b, i) => i === 5 ? 'face' : 'manga', 'コミック');
  bookcase((0.92 + IX1 - 0.34) / 2, IZ0 + 0.005, 0, IX1 - 0.34 - 0.92, H, NS, DP, (b, i) => i === 0 ? 'large' : i === 4 ? 'face' : 'tanko', '趣味 · 実用');
  // printed section boards hung from the ceiling over the wall cases
  for (const [t, x, z, ry] of [['文庫 · 新書', IX0 + 0.35, -9.0, Math.PI / 2], ['文芸 · エッセイ', IX0 + 0.35, -5.2, Math.PI / 2], ['絵本 · 図鑑', IX1 - 0.35, -9.2, -Math.PI / 2]]) {
    const g = S.k.group([x, 2.55, z], ry); const kk = ctx.kit(g); g.updateWorldMatrix(true, false);
    kk.box(1.0, 0.18, 0.02, mCase, [0, 0, 0]); S.card(headerReg(t), 0.94, 0.14, [0, 0, 0.011], null, null, kk);
    ctx.wires.add([g.localToWorld(new THREE.Vector3(-0.4, 0.09, 0)), g.localToWorld(new THREE.Vector3(-0.4, CI - 2.55, 0))], { width: 0.005, color: '#6d6a80' });
    ctx.wires.add([g.localToWorld(new THREE.Vector3(0.4, 0.09, 0)), g.localToWorld(new THREE.Vector3(0.4, CI - 2.55, 0))], { width: 0.005, color: '#6d6a80' });
  }
  S.box(IX0 + DP / 2, (-11.62 - 3.2) / 2, DP + 0.02, 8.42, -1, FY + H);
  S.box(IX1 - DP / 2, (-11.62 - 6.35) / 2, DP + 0.02, 5.27, -1, FY + H);
  S.box(IX1 - DP / 2, (-4.95 - 3.2) / 2, DP + 0.02, 1.75, -1, FY + H);
  S.box(0, IZ0 + DP / 2, IX1 - IX0, DP + 0.02, -1, FY + H);

  // ---------------- two double-sided island shelves + face-out end caps + top displays
  const IH = 1.36, INS = 4, ID = 0.27, IZa = -9.25, IZb = -5.85, ilen = IZb - IZa, icz = (IZa + IZb) / 2;
  for (const [ix, plans] of [[-1.35, ['manga', 'bunko']], [1.55, ['tanko', 'kids']]]) {
    k.box(0.03, IH, ilen, mBack, [ix, FY + IH / 2, icz]);
    bookcase(ix + 0.015, icz, Math.PI / 2, ilen, IH, INS, ID, (b, i) => (i === INS - 1 && b === 1) ? 'face' : plans[1], null, { back: false });
    bookcase(ix - 0.015, icz, -Math.PI / 2, ilen, IH, INS, ID, (b, i) => (i === INS - 1 && b === 2) ? 'face' : plans[0], null, { back: false });
    k.box(0.62, 0.03, ilen + 0.02, mBoard, [ix, FY + IH + 0.03, icz]);
    // top: flat stacks + a POP
    const tg = S.k.group([ix, FY + IH + 0.045, icz], 0), r = ctx.rng('bk.top' + ix);
    for (let j = 0; j < 4; j++) { const z = -ilen / 2 + 0.45 + j * (ilen - 0.9) / 3, v = r.int(0, 31), nn = r.int(3, 6); for (let s = 0; s < nn; s++) G.add('cover', tg, [(j % 2 ? 0.1 : -0.1), s * 0.022 + 0.011, z + 0.095], [0.13, 0.19, 0.022], white(r, 0.93), [-Math.PI / 2, (r() - 0.5) * 0.08, 0], v); }
    // end caps (entrance side and register side)
    for (const [ez, ry] of [[IZb, 0], [IZa, Math.PI]]) {
      const eg = S.k.group([ix, FY, ez], ry); const ke = ctx.kit(eg);
      ke.box(0.6, IH, 0.02, mCase, [0, IH / 2, 0.01]);
      for (const y of [0.35, 0.72, 1.08]) { ke.box(0.58, 0.015, 0.08, mCaseL, [0, y, 0.05]); ke.box(0.58, 0.03, 0.01, mCaseL, [0, y + 0.02, 0.09]); faceOut(eg, -0.28, 0.28, y + 0.008, 0.09, ctx.rng('bk.ec' + ix + ez + y), 0.2, 0.14); }
    }
    S.box(ix, icz, 0.62, ilen + 0.2, -1, FY + IH + 0.1);
  }
  const rPOP = A.inner.region(140, 80, (g, w, h2) => { g.fillStyle = '#f6e3a0'; U.rr(g, 0, 0, w, h2, 12); g.fill(); U.text(g, '店長', w / 2, 24, 20, F.hand, '#d9463b', { weight: 400 }); U.text(g, 'おすすめ!', w / 2, 56, 26, F.hand, INK, { weight: 400 }); });
  k.box(0.008, 0.16, 0.008, mMetal, [1.55, FY + IH + 0.13, IZb - 0.4]);
  S.card(rPOP, 0.26, 0.15, [1.55, FY + IH + 0.27, IZb - 0.4]);
  const rManga = A.inner.region(140, 80, (g, w, h2) => { g.fillStyle = '#e8506a'; U.rr(g, 0, 0, w, h2, 12); g.fill(); U.text(g, '新刊コミック', w / 2, 28, 22, F.round, '#fff', { weight: 900 }); U.text(g, '続々入荷!', w / 2, 58, 20, F.round, '#fff', { weight: 900 }); });
  k.box(0.008, 0.16, 0.008, mMetal, [-1.35, FY + IH + 0.13, IZb - 0.4]);
  S.card(rManga, 0.26, 0.15, [-1.35, FY + IH + 0.27, IZb - 0.4]);

  // ---------------- flat display tables (平台) with stacks of new releases
  const rNewP = A.inner.region(140, 70, (g, w2, h2) => { g.fillStyle = '#d9463b'; U.rr(g, 0, 0, w2, h2, 10); g.fill(); U.text(g, '新刊コーナー', w2 / 2, h2 / 2 + 2, 22, F.sans, '#fff', { weight: 900 }); });
  const rBest = A.inner.region(140, 70, (g, w2, h2) => { g.fillStyle = GREEN; U.rr(g, 0, 0, w2, h2, 10); g.fill(); U.text(g, '話題の本', w2 / 2, h2 / 2 + 2, 24, F.serif, CREAM, { weight: 700 }); });
  for (const [x0, x1, reg] of [[0.7, 2.5, rNewP], [-2.6, -1.7, rBest]]) {
    const z0 = -4.8, z1 = -4.0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    k.box(w - 0.06, 0.62, d - 0.06, mCaseL, [cx, FY + 0.31, cz]);
    k.box(w, 0.04, d, mBoard, [cx, FY + 0.64, cz]);
    k.box(w - 0.1, 0.06, d - 0.1, mCase, [cx, FY + 0.03, cz]);
    // stepped riser in the middle
    k.box(w - 0.3, 0.12, 0.22, mBoard, [cx, FY + 0.72, cz]);
    const tg = S.k.group([cx, FY + 0.66, cz], 0), r = ctx.rng('bk.flat' + x0);
    const cols = Math.floor((w - 0.1) / 0.2);
    for (let i = 0; i < cols; i++) for (const zr of [-0.26, 0.26]) {
      const x = -w / 2 + 0.1 + (i + 0.5) * (w - 0.2) / cols, v = r.int(0, 31), nn = r.int(3, 8);
      for (let s = 0; s < nn; s++) G.add('cover', tg, [x + (r() - 0.5) * 0.006, s * 0.021 + 0.0105, zr + 0.095], [0.13, 0.19, 0.021], white(r, 0.93), [-Math.PI / 2, (r() - 0.5) * 0.05, 0], v);
    }
    for (let i = 0; i < cols; i++) { const x = -w / 2 + 0.1 + (i + 0.5) * (w - 0.2) / cols; G.add('cover', tg, [x, 0.12, 0.02], [0.13, 0.19, 0.02], white(r, 0.93), [-0.25, 0, 0], r.int(0, 31)); G.add('slab', tg, [x, 0.12, 0.05], [0.1, 0.012, 0.012], '#c9ced3'); }
    k.box(0.008, 0.22, 0.008, mMetal, [cx, FY + 0.95, cz - 0.1]);
    S.card(reg, 0.32, 0.16, [cx, FY + 1.1, cz - 0.1]);
    S.box(cx, cz, w + 0.02, d + 0.02, -1, FY + 0.8);
  }

  // ---------------- magazine rack under the north window (faces -x)
  {
    const z0 = -6.3, z1 = -4.95, cz = (z0 + z1) / 2, len = z1 - z0;
    const g = S.k.group([IX1 - 0.02, FY, cz], -Math.PI / 2); const kg = ctx.kit(g);
    kg.box(len, 1.1, 0.02, mBack, [0, 0.55, 0.01]);
    for (const s of [-1, 1]) kg.box(0.025, 1.1, 0.42, mCase, [s * len / 2, 0.55, 0.21]);
    kg.box(len, 0.1, 0.42, mCase, [0, 0.05, 0.21]);
    const r = ctx.rng('bk.magr');
    const nn = Math.floor(len / 0.23), sp = (len - 0.04) / nn;
    for (let t = 0; t < 3; t++) {
      const y = 0.3 + t * 0.29, zz = 0.3 - t * 0.09;
      kg.box(len - 0.04, 0.015, 0.14, mCaseL, [0, y - 0.008, zz], [0.25, 0, 0]);
      kg.box(len - 0.04, 0.045, 0.012, mCaseL, [0, y + 0.012, zz + 0.075]);
      for (let i = 0; i < nn; i++) { const v = r.int(0, 31); for (let j = 0; j < 3; j++) G.add('mag', g, [-len / 2 + 0.02 + sp * (i + 0.5), y + 0.004, zz + 0.045 - j * 0.011], [0.2, 0.275, 0.009], white(r), [-0.26, (r() - 0.5) * 0.04, 0], v); }
    }
    S.box(IX1 - 0.23, cz, 0.44, len, -1, FY + 1.1);
  }

  // ---------------- register counter with POS, card reader, bookmark stand, covers, bags
  {
    const x0 = -0.75, x1 = 1.35, z0 = -10.8, z1 = -10.25, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    k.box(w, 0.9, d, M.inner('#8a6446', 0.22, { map: T.wood }), [cx, FY + 0.45, cz]);
    for (let i = 0; i < 7; i++) k.box(0.02, 0.8, 0.01, mCase, [x0 + 0.15 + i * (w - 0.3) / 6, FY + 0.45, z1 + 0.004]);
    k.rbox(w + 0.08, 0.045, d + 0.08, 0.015, mBoard, [cx, FY + 0.92, cz]);
    const ty = FY + 0.945;
    // POS + customer display + card reader
    k.box(0.36, 0.1, 0.34, mDark, [cx + 0.55, ty + 0.05, cz - 0.02]);
    const sg = S.k.group([cx + 0.55, ty + 0.2, cz - 0.08], Math.PI); const ks = ctx.kit(sg);
    ks.cyl(0.018, 0.018, 0.12, mDark, [0, -0.06, 0], null, 8);
    ks.box(0.32, 0.22, 0.03, mInk, [0, 0.06, 0], [-0.25, 0, 0]);
    const rScr = A.glow.region(96, 64, (g, w2, h2) => { g.fillStyle = '#e8f1ea'; g.fillRect(0, 0, w2, h2); g.fillStyle = GREEN; g.fillRect(0, 0, w2, 14); U.text(g, 'こもれび書店', w2 / 2, 8, 10, F.sans, '#fff', { weight: 700 }); U.text(g, '¥ 1,540', w2 / 2, 42, 16, F.en, INK, { weight: 900 }); });
    S.card(rScr, 0.28, 0.18, [0, 0.064, 0.018], [-0.25, 0, 0], null, ks);
    k.cyl(0.035, 0.045, 0.03, mDark, [cx + 0.2, ty + 0.015, cz + 0.12], null, 10);
    const pg = S.k.group([cx + 0.2, ty + 0.05, cz + 0.12], 0); const kp = ctx.kit(pg);
    kp.rbox(0.085, 0.16, 0.03, 0.01, mInk, [0, 0.07, 0], [-0.5, 0, 0]);
    const rPad = A.inner.region(64, 96, (g, w2, h2) => { g.fillStyle = '#3a3346'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#9fd6e8'; g.fillRect(8, 8, w2 - 16, 26); for (let i = 0; i < 12; i++) { g.fillStyle = i === 11 ? '#5a9e58' : i === 9 ? '#d9463b' : '#d9d6ce'; U.rr(g, 9 + (i % 3) * 16, 42 + Math.floor(i / 3) * 13, 13, 10, 2); g.fill(); } });
    S.card(rPad, 0.07, 0.12, [0, 0.075, 0.017], [-0.5, 0, 0], null, kp);
    // bookmark stand: slotted block with individual bookmarks
    k.box(0.24, 0.05, 0.08, mCaseL, [cx - 0.2, ty + 0.025, cz + 0.13]);
    for (let i = 0; i < 8; i++) G.add('bmark', S, [cx - 0.3 + i * 0.028, ty + 0.03, cz + 0.13 + (i % 2 ? 0.012 : -0.012)], [0.04, 0.14, 0.003], white(rr, 0.95), [0, 0, (i - 3.5) * 0.03], i);
    const rBm = A.inner.region(96, 32, (g, w2, h2) => { g.fillStyle = CREAM; g.fillRect(0, 0, w2, h2); U.text(g, 'しおり ご自由に', w2 / 2, h2 / 2 + 1, 13, F.sans, GREEN, { weight: 700, maxW: w2 - 6 }); });
    S.card(rBm, 0.14, 0.045, [cx - 0.2, ty + 0.025, cz + 0.171]);
    // paper book-cover stack + folded covers, paper bags, pen cup, coin tray
    for (let i = 0; i < 12; i++) k.box(0.3, 0.004, 0.21, M.inner(i % 3 ? '#e9dcc0' : '#d8c8a8', 0.34), [cx - 0.62, ty + 0.002 + i * 0.004, cz - 0.08], [0, (i % 4) * 0.02, 0]);
    k.box(0.22, 0.012, 0.16, M.inner('#3f5f4f', 0.2), [cx - 0.64, ty + 0.054, cz - 0.08], [0, 0.1, 0]);
    k.cyl(0.035, 0.03, 0.09, M.inner('#6f8455', 0.3), [cx + 0.92, ty + 0.045, cz + 0.12], null, 10);
    for (let i = 0; i < 4; i++) G.add('stem', S, [cx + 0.92 + (i - 1.5) * 0.012, ty + 0.03, cz + 0.12], [0.008, 0.14, 0.008], ['#3a3346', '#d9463b', '#3f7fb5', '#3a3346'][i], [(i - 1.5) * 0.1, 0, (i % 2 - 0.5) * 0.15]);
    k.box(0.16, 0.012, 0.12, M.inner('#5a4032', 0.2), [cx + 0.25, ty + 0.006, cz - 0.1]);
    // paper bags hanging on hooks at the clerk side + a stack of flat bags
    for (let i = 0; i < 3; i++) { k.box(0.2 + i * 0.04, 0.26 + i * 0.03, 0.01, M.inner('#d8c3a0', 0.32), [cx - 0.5 + i * 0.32, FY + 0.72 - i * 0.015, z0 - 0.012]); k.cyl(0.006, 0.006, 0.05, mMetal, [cx - 0.5 + i * 0.32, FY + 0.87, z0 - 0.02], [Math.PI / 2, 0, 0], 5); }
    // small potted plant on the counter (smooth foliage)
    k.cyl(0.07, 0.055, 0.1, M.inner('#e8e2d6', 0.35), [cx + 0.95, ty + 0.05, cz - 0.12], null, 12);
    C.shrub(S, cx + 0.95, ty + 0.09, cz - 0.12, { r: 0.1, h: 0.16, green: '#6f9a5a', seed: 41 });
    S.box(cx, cz, w + 0.1, d + 0.1, -1, FY + 0.97);
    // hanging お会計 sign
    const rPay = A.inner.region(120, 60, (g, w2, h2) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w2, h2); U.text(g, 'お会計', w2 / 2, 22, 20, F.sans, GREEN, { weight: 900 }); U.text(g, '図書カード使えます', w2 / 2, 46, 11, F.sans, INK, { weight: 700 }); });
    k.box(0.42, 0.22, 0.02, mCase, [cx, 2.5, cz + 0.02]);
    S.card(rPay, 0.4, 0.2, [cx, 2.5, cz + 0.031]);
    ctx.wires.add([S.world(cx - 0.15, CI, cz), S.world(cx - 0.15, 2.61, cz)], { width: 0.006, color: '#6d6a80' });
    ctx.wires.add([S.world(cx + 0.15, CI, cz), S.world(cx + 0.15, 2.61, cz)], { width: 0.006, color: '#6d6a80' });
    // clerk stool behind the counter
    k.cyl(0.16, 0.16, 0.04, M.inner('#8c3a45', 0.25), [cx - 0.3, FY + 0.62, z0 - 0.45], null, 14);
    k.cyl(0.02, 0.02, 0.6, mInk, [cx - 0.3, FY + 0.3, z0 - 0.45], null, 6);
    k.cyl(0.18, 0.2, 0.03, mInk, [cx - 0.3, FY + 0.015, z0 - 0.45], null, 12);
  }

  // ---------------- back doorway with noren
  {
    const rNoren = A.lit.region(160, 128, (g, w, h) => { g.fillStyle = GREEN; g.fillRect(0, 0, w, h); g.fillStyle = '#35523f'; g.fillRect(w / 2 - 1, 22, 2, h); g.fillStyle = CREAM; g.beginPath(); g.arc(w / 2, 60, 26, 0, 6.3); g.fill(); U.text(g, '本', w / 2, 62, 34, F.brush, GREEN, { weight: 400 }); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 0, w, 10); });
    k.box(1.1, 2.1, 0.02, M.inner('#3a3346', 0.05), [0.15, FY + 1.05, IZ0 + 0.01]);
    for (const s of [-1, 1]) k.box(0.06, 2.14, 0.08, mCase, [0.15 + s * 0.58, FY + 1.07, IZ0 + 0.04]);
    k.box(1.22, 0.07, 0.08, mCase, [0.15, FY + 2.14, IZ0 + 0.04]);
    const nm = S.card(rNoren, 1.0, 0.8, [0.15, FY + 1.65, IZ0 + 0.09]); nm.material = M.t('#ffffff', { map: rNoren.m.map, side: 'double', paint: 0, emissive: '#3a3346', emissiveIntensity: 0.15 });
    k.cyl(0.015, 0.015, 1.2, M.inner('#8a6446', 0.2), [0.15, FY + 2.07, IZ0 + 0.09], [0, 0, Math.PI / 2], 6);
  }

  // ---------------- kick stool, step ladder, stacked delivery bundles
  {
    const mK = M.inner('#5a8a9a', 0.28);
    k.mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.36, 16, 1), mK, [-3.1, FY + 0.18, -7.6]);
    k.cyl(0.155, 0.155, 0.015, M.inner('#3a3346', 0.1), [-3.1, FY + 0.365, -7.6], null, 16);
    k.mesh(new THREE.TorusGeometry(0.19, 0.012, 5, 16), M.inner('#3a3346', 0.1), [-3.1, FY + 0.02, -7.6], [Math.PI / 2, 0, 0]);
    S.cyl(-3.1, -7.6, 0.21, -1, FY + 0.38);
    const g = S.k.group([-3.2, FY, -10.4], 0.35); const kl = ctx.kit(g);
    for (const s of [-1, 1]) { kl.box(0.04, 0.95, 0.04, mBoard, [s * 0.2, 0.47, 0.06], [-0.14, 0, 0]); kl.box(0.035, 0.9, 0.035, mBoard, [s * 0.2, 0.45, -0.18], [0.14, 0, 0]); }
    for (let i = 0; i < 3; i++) kl.box(0.42, 0.03, 0.14, mBoard, [0, 0.24 + i * 0.28, 0.07 - i * 0.04]);
    S.cyl(-3.2, -10.4, 0.28, -1, FY + 1.0);
    // bundles of new stock waiting to be shelved (tied with string)
    for (let j = 0; j < 3; j++) { const bg = S.k.group([2.9, FY + j * 0.2, -10.95], 0.1 * j); for (let i = 0; i < 9; i++) G.add('book', bg, [0.1, i * 0.021 + 0.0105, 0.0], [0.021, 0.2, 0.14], rr.pick(PAL), [0, 0, Math.PI / 2], rr.int(0, 15)); ctx.kit(bg).box(0.012, 0.2, 0.15, M.inner('#e9dcc0', 0.34), [0, 0.1, 0]); }
    S.box(2.9, -10.95, 0.3, 0.3, -1, FY + 0.6);
  }

  // ---------------- window displays: low platforms with face-out books on stands, manga poster, maneki-neko
  {
    const pz = ZF - 0.45;
    const rMangaP = A.lit.region(240, 340, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe3f4'); gr.addColorStop(1, '#fbe3ea'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) U.sakura(g, (i * 67) % w, (i * 41 + 30) % (h - 80), 8 + (i % 3) * 4, 'rgba(242,181,200,0.85)');
      g.fillStyle = '#4a4f7a'; g.beginPath(); g.ellipse(w / 2, 132, 62, 70, 0, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 62, 130, 124, 70);
      g.fillStyle = '#f7dcc8'; g.beginPath(); g.ellipse(w / 2, 142, 44, 50, 0, 0, 6.3); g.fill();
      g.fillStyle = '#2f64b5'; g.beginPath(); g.ellipse(w / 2 - 17, 150, 8, 11, 0, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(w / 2 + 17, 150, 8, 11, 0, 0, 6.3); g.fill();
      g.fillStyle = '#f4f1e8'; g.beginPath(); g.moveTo(w / 2 - 70, 250); g.lineTo(w / 2 - 20, 196); g.lineTo(w / 2, 214); g.lineTo(w / 2 + 20, 196); g.lineTo(w / 2 + 70, 250); g.lineTo(w / 2 + 70, 280); g.lineTo(w / 2 - 70, 280); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(0, 0, w, 58);
      U.text(g, '放課後さくら通信', w / 2, 24, 28, F.round, '#c2476a', { weight: 900, maxW: w - 16 });
      U.text(g, '第12巻', w / 2, 48, 18, F.round, INK, { weight: 900 });
      g.fillStyle = '#d9463b'; g.fillRect(0, h - 56, w, 56); U.text(g, '本日発売!', w / 2, h - 28, 34, F.round, '#fff', { weight: 900 });
    });
    S.card(rMangaP, 0.5, 0.71, [-2.9, FY + 1.35, ZF - 0.13]);
    k.box(0.02, 0.9, 0.02, mMetal, [-2.9, FY + 0.95, ZF - 0.16]);
    for (const [a, b] of [[DW0, DW1], [EW0, EW1]]) {
      k.box(b - a - 0.1, 0.4, 0.5, M.inner('#8a6446', 0.22, { map: T.wood }), [(a + b) / 2, FY + 0.2, pz]);
      k.box(b - a - 0.06, 0.02, 0.52, M.inner('#e9e2d0', 0.35), [(a + b) / 2, FY + 0.41, pz]);
      const g = S.k.group([(a + b) / 2, FY + 0.42, pz], Math.PI), r = ctx.rng('bk.win' + a); // stands face the street
      for (let i = 0; i < 5; i++) {
        const x = -(b - a) / 2 + 0.28 + i * (b - a - 0.56) / 4;
        if (a < 0 && Math.abs(-x + (a + b) / 2 + 2.9) < 0.3) continue;
        G.add('cover', g, [x, 0.02, 0.05], [0.14, 0.2, 0.018], white(r, 0.94), [-0.2, 0, 0], r.int(0, 31));
        G.add('slab', g, [x, 0, 0.1], [0.1, 0.02, 0.04], '#c9ced3');
        G.add('slab', g, [x, 0, -0.02], [0.012, 0.16, 0.012], '#c9ced3', [0.35, 0, 0]);
        if (i % 2) for (let s = 0; s < 4; s++) G.add('cover', g, [x + 0.02, s * 0.02 + 0.01, -0.12], [0.13, 0.19, 0.02], white(r, 0.94), [-Math.PI / 2, 0.2, 0], r.int(0, 31));
      }
    }
    // maneki-neko (招き猫) in the left window
    const g0 = S.k.group([-2.4, FY + 0.43, pz + 0.1], Math.PI - 0.25); const kn = ctx.kit(g0);
    const mW = M.inner('#f7f2e8', 0.3), mR = M.inner('#d9463b', 0.3), mG = M.inner('#e0b84a', 0.3), mI = M.inner('#3a3346', 0.1);
    kn.cyl(0.07, 0.085, 0.15, mW, [0, 0.075, 0], null, 14);
    kn.sphere(0.075, mW, [0, 0.215, 0.005], 14);
    for (const s of [-1, 1]) kn.mesh(new THREE.ConeGeometry(0.026, 0.05, 6), mW, [s * 0.042, 0.285, 0], [0, 0.78, s * -0.3]);
    kn.cyl(0.074, 0.074, 0.016, mR, [0, 0.148, 0.003], null, 14);
    kn.sphere(0.016, mG, [0, 0.138, 0.076], 8);
    kn.cyl(0.021, 0.021, 0.09, mW, [0.07, 0.25, 0.03], [0.2, 0, -0.25], 8);
    kn.box(0.055, 0.075, 0.012, mG, [-0.025, 0.08, 0.083]);
    for (const s of [-1, 1]) kn.box(0.016, 0.008, 0.006, mI, [s * 0.026, 0.225, 0.077]);
    S.box((DW0 + DW1) / 2, pz, DW1 - DW0, 0.5, -1, FY + 0.6);
    S.box((EW0 + EW1) / 2, pz, EW1 - EW0, 0.5, -1, FY + 0.6);
  }
}

/** soft warm radial light pool (transparent, self-lit) — one shared material */
let _pool = null;
export function poolMat(ctx, C) {
  if (_pool && _pool.__ctx === ctx) return _pool;
  const t = ctx.tex.draw(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,226,180,0.34)'); gr.addColorStop(0.55, 'rgba(255,220,170,0.14)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { key: 'shopsA.pool' });
  _pool = ctx.mat.emissive('#ffe6c4', 1.0, { map: t, transparent: true, depthWrite: false });
  _pool.__ctx = ctx;
  return _pool;
}
