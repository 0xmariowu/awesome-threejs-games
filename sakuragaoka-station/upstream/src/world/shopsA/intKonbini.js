// W1 ひだまりマート — interior, all modelled: tiled floor, ceiling fixtures / AC cassettes, gondolas with
// individually instanced products, end caps, reach-in coolers with doors / handles / drinks, open chilled
// case (bento, onigiri, sandwiches), register counter (POS, card readers, printers, scanners), hot-snack
// warmer, steamer, self coffee machine + cup stacks, back counter with microwaves, ATM, copier,
// multimedia ticket terminal, magazine rack with single magazines, basket stack, eat-in counter,
// back-room door. Only printed things (labels, screens, signs, price rails) are textures.
import * as THREE from 'three';

export function buildKonbiniInterior(ctx, C, S, D) {
  const { M, A, U, F } = C; const G = C.G; const k = S.k;
  const { FY, CY, IX0, IX1, IZ0, IZ1, gx, TEAL, TEAL_D, YEL, INK } = D;
  const rr = ctx.rng('kb.int2');
  G.setShop('W1', 0.42);
  const white = (r, lo = 0.9) => new THREE.Color().setScalar(lo + r() * (1 - lo));
  const range = (v, r) => Array.isArray(v) ? v[0] + r() * (v[1] - v[0]) : v;

  // materials (interior warm self-light quantised by albedo)
  const mWhite = M.inner('#eceae4', 0.32), mShelf = M.inner('#e2e0d9', 0.32), mBase = M.inner('#cfccc4', 0.25);
  const mKick = M.inner('#8f969d', 0.2), mMetal = M.inner('#b8bdc2', 0.28), mDark = M.inner('#4f5358', 0.16), mInk = M.inner('#3a3346', 0.1);
  const mTealI = M.inner(TEAL, 0.28), mYelI = M.inner(YEL, 0.3), mPeg = M.inner('#dcd9d1', 0.3), mBody = M.inner('#e6e6e2', 0.3);
  const mGlass = ctx.mat.glass({ opacity: 0.05, streaks: false, tint: '#c9d6de' }), mLamp = M.glow('#fff3dc', 1.3), mLed = M.glow('#f4f9ff', 1.2);
  const mPink = M.inner('#f7d3de', 0.35), mCounter = M.inner('#f1efe9', 0.32), mTop = M.inner('#d6d2c8', 0.3);

  // printed price rail (flat graphic) — one strip reused on every shelf edge
  const rRail = A.inner.region(512, 24, (g, w, h) => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { const x = 8 + i * 56; g.fillStyle = i % 3 === 1 ? '#f2d774' : '#ffffff'; g.fillRect(x, 3, 40, h - 6); g.strokeStyle = 'rgba(60,60,80,0.35)'; g.lineWidth = 1; g.strokeRect(x, 3, 40, h - 6); U.text(g, '¥' + (98 + ((i * 37) % 9) * 20), x + 20, h / 2 + 1, 11, F.en, i % 3 === 1 ? '#d9463b' : INK, { weight: 900 }); }
  }, { bg: '#f7f5ef' });
  const rail = (kk, len, y, z) => { for (let x = -len / 2; x < len / 2 - 0.05; x += 1.2) { const w = Math.min(1.2, len / 2 - x); S.card(rRail, w - 0.01, 0.036, [x + w / 2, y, z], null, null, kk); } };

  // ---------------- product templates (sizes in metres; w = diameter for round things)
  const TPL = {
    bagL: { kind: 'bag', w: [0.2, 0.24], h: [0.27, 0.29], d: 0.075, vars: [0, 1, 2, 3, 6, 7, 9], deep: 2, n: [2, 3] },
    bagM: { kind: 'bag', w: [0.15, 0.18], h: [0.21, 0.24], d: 0.06, vars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11], deep: 2, n: [2, 4] },
    bagS: { kind: 'bag', w: [0.1, 0.12], h: [0.15, 0.17], d: 0.045, vars: [4, 5, 6, 8, 11], deep: 2, n: [2, 4] },
    bread: { kind: 'bag', w: [0.17, 0.2], h: [0.1, 0.13], d: [0.14, 0.16], vars: [12, 13, 14, 15], deep: 2, n: [2, 3], stack: 2 },
    boxL: { kind: 'pbox', w: [0.17, 0.22], h: [0.2, 0.25], d: [0.06, 0.08], vars: [0, 2, 3, 14, 15], deep: 2, n: [2, 3] },
    boxM: { kind: 'pbox', w: [0.1, 0.14], h: [0.13, 0.17], d: [0.04, 0.06], vars: [0, 1, 2, 4, 5, 6, 12, 13, 15], deep: 2, n: [2, 4] },
    boxS: { kind: 'pbox', w: [0.06, 0.08], h: [0.08, 0.1], d: 0.03, vars: [1, 5, 6, 13, 4], deep: 2, n: [3, 5], stack: 2 },
    cupL: { kind: 'cupmen', lo: 'cupLo', w: 0.13, h: 0.1, vars: [0, 1, 2, 3, 4, 5, 6, 7], deep: 2, n: [2, 3], stack: 2 },
    cup: { kind: 'cupmen', lo: 'cupLo', w: 0.1, h: 0.085, vars: [0, 1, 2, 3, 4, 5, 6, 7], deep: 2, n: [2, 4], stack: 2 },
    retort: { kind: 'pbox', w: 0.14, h: 0.19, d: 0.04, vars: [7, 11], deep: 2, n: [3, 4] },
    tissue: { kind: 'pbox', w: 0.24, h: 0.09, d: 0.12, vars: [8], deep: 2, n: [3, 4], stack: 3 },
    mask: { kind: 'pbox', w: 0.18, h: 0.1, d: 0.09, vars: [9], deep: 2, n: [2, 3], stack: 2 },
    paste: { kind: 'pbox', w: 0.19, h: 0.045, d: 0.04, vars: [10], deep: 2, n: [2, 3], stack: 4 },
    bottleL: { kind: 'pet', lo: 'petLo', w: 0.1, h: 0.31, vars: [0, 3, 7, 11, 2], deep: 2, n: [2, 3] },
    detergent: { kind: 'pet', lo: 'petLo', w: 0.085, h: 0.24, vars: [3, 7, 12, 15], deep: 2, n: [2, 3] },
    canF: { kind: 'can', lo: 'canLo', w: 0.085, h: 0.045, vars: [8, 13, 3, 11], deep: 2, n: [3, 4], stack: 3 },
    pet: { kind: 'pet', lo: 'petLo', w: 0.066, h: 0.205, vars: [0, 1, 3, 5, 7], deep: 2, n: [2, 3] },
    can: { kind: 'can', lo: 'canLo', w: 0.066, h: 0.122, vars: [0, 1, 2, 3, 4], deep: 2, n: [3, 4] },
    canL: { kind: 'can', lo: 'canLo', w: 0.066, h: 0.165, vars: [2, 3, 10, 11], deep: 2, n: [2, 3] },
    carton: { kind: 'carton', w: 0.07, h: 0.2, d: 0.07, vars: [0, 1, 2, 3, 4, 5, 6], deep: 2, n: [2, 3] },
    cartonS: { kind: 'carton', w: 0.06, h: 0.12, d: 0.045, vars: [0, 1, 2, 6], deep: 2, n: [3, 4] },
  };
  /** fill a shelf row in group-local space: x0..x1 along the shelf, products face +z, front edge at zf */
  function fill(g, x0, x1, y, zf, zb, tpls, r, o = {}) {
    let x = x0, tries = 0;
    while (x < x1 - 0.03 && tries < 8) {
      const t = r.pick(tpls);
      const w = range(t.w, r), h = range(t.h, r), d = t.d !== undefined ? range(t.d, r) : w;
      const n = r.int(t.n?.[0] ?? 1, t.n?.[1] ?? 3);
      const v = r.pick(o.vars || t.vars);
      let placed = 0;
      for (let f = 0; f < n; f++) {
        if (x + w > x1) break;
        const xc = x + w / 2;
        let z = zf - d / 2 - 0.004;
        for (let dd = 0; dd < (o.deep ?? t.deep ?? 2) && z - d / 2 >= zb - 1e-3; dd++) {
          const kind = dd > 0 && t.lo ? t.lo : t.kind;
          for (let s = 0; s < (t.stack ?? 1); s++) {
            if (o.maxH && (s + 1) * h > o.maxH) break;
            G.add(kind, g, [xc + (r() - 0.5) * 0.004, y + s * (h + 0.001), z + (r() - 0.5) * 0.004], [w, h, d], white(r), [0, (r() - 0.5) * 0.07, 0], v);
          }
          z -= d + 0.005;
        }
        x += w + 0.004; placed++;
      }
      if (!placed) { tries++; continue; }
      tries = 0; x += 0.008 + r() * 0.01;
    }
  }

  // ---------------- floor: grout base + individual tiles
  {
    const cx = (IX0 + IX1) / 2, cz = (IZ0 + IZ1) / 2;
    const fl = k.plane(IX1 - IX0, IZ1 - IZ0, M.inner('#b9b6ae', 0.2), [cx, FY + 0.002, cz], [-Math.PI / 2, 0, 0]); fl.castShadow = false;
    const ts = 0.4, gap = 0.008;
    let ix = 0;
    for (let x = IX0; x < IX1 - 1e-3; x += ts, ix++) {
      let iz = 0;
      for (let z = IZ0; z < IZ1 - 1e-3; z += ts, iz++) {
        const w = Math.min(ts, IX1 - x) - gap, d = Math.min(ts, IZ1 - z) - gap;
        const base = (ix + iz) % 2 ? 0.93 : 0.9, c = new THREE.Color('#f1efe8').multiplyScalar(base + rr() * 0.04);
        G.add('tile', S, [x + gap / 2 + w / 2, FY + 0.005, z + gap / 2 + d / 2], [w, 1, d], c);
      }
    }
    // entrance mat (woven, raised a little)
    k.box(1.7, 0.012, 0.75, M.inner('#4f5a66', 0.12), [1.0, FY + 0.012, -3.25]);
    const rMat = A.inner.region(200, 80, (g, w, h) => { g.fillStyle = '#4f5a66'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7d8a96'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); U.text(g, 'いらっしゃいませ', w / 2, h / 2 + 1, 24, F.round, '#e8e6df', { weight: 700 }); });
    S.card(rMat, 1.6, 0.64, [1.0, FY + 0.0185, -3.25], [-Math.PI / 2, 0, 0]);
  }

  // ---------------- ceiling: light fixtures, AC cassettes, detectors, speakers, camera domes, mirror
  {
    const mFix = M.inner('#f3f1eb', 0.45);
    for (const z of [-4.1, -6.1, -8.1, -10.1]) for (const x of [-4.2, -1.6, 1.0, 3.6]) {
      k.box(1.62, 0.055, 0.3, mFix, [x, CY - 0.028, z]);
      k.box(1.5, 0.02, 0.22, mLamp, [x, CY - 0.062, z]);
      for (const s of [-1, 1]) k.box(0.04, 0.03, 0.3, mMetal, [x + s * 0.79, CY - 0.07, z]);
    }
    for (const [x, z] of [[-0.3, -7.1], [3.6, -7.1]]) {
      k.box(0.92, 0.035, 0.92, mFix, [x, CY - 0.018, z]);
      for (let i = 0; i < 7; i++) k.box(0.5, 0.012, 0.03, M.inner('#c9c9c4', 0.28), [x, CY - 0.04, z - 0.21 + i * 0.07]);
      for (const [dx, dz, ry] of [[0, 0.37, 0], [0, -0.37, 0], [0.37, 0, Math.PI / 2], [-0.37, 0, Math.PI / 2]]) k.box(0.62, 0.012, 0.08, M.inner('#dcdad3', 0.3), [x + dx, CY - 0.05, z + dz], [dz ? Math.sign(dz) * 0.5 : 0, ry, dx ? -Math.sign(dx) * 0.5 : 0]);
    }
    for (const [x, z] of [[-2.9, -5.1], [2.3, -9.1], [4.9, -4.2]]) { k.cyl(0.06, 0.07, 0.035, mWhite, [x, CY - 0.018, z], null, 12); k.cyl(0.012, 0.012, 0.012, M.glow('#ff7a6a', 1.0), [x + 0.035, CY - 0.04, z], null, 6); }
    for (const [x, z] of [[-1.6, -9.1], [3.6, -5.1]]) { k.cyl(0.11, 0.11, 0.015, mWhite, [x, CY - 0.008, z], null, 16); k.cyl(0.08, 0.08, 0.004, M.inner('#b9bcc0', 0.2), [x, CY - 0.017, z], null, 16); }
    for (const [x, z] of [[-5.5, -3.2], [5.45, -11.45]]) { k.cyl(0.09, 0.09, 0.02, mWhite, [x, CY - 0.01, z], null, 14); k.mesh(new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.inner('#3f3d45', 0.1), [x, CY - 0.02, z]); }
    // convex security mirror in the back corner
    const mg = S.k.group([-1.5, 2.86, IZ0 + 0.03], 0); const km = ctx.kit(mg);
    km.box(0.04, 0.04, 0.18, mMetal, [0, 0, 0.09]);
    km.mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, 0.55), M.inner('#c7d2da', 0.45), [0, 0, 0.18 - 0.24], [Math.PI / 2, 0, 0]);
    km.mesh(new THREE.TorusGeometry(0.146, 0.012, 5, 20), M.inner('#e9a23b', 0.3), [0, 0, 0.185]);
  }

  // ---------------- gondolas
  const GH = 1.42, LEV = [0.13, 0.46, 0.79, 1.12];
  const rPOP = A.inner.region(200, 90, (g, w, h) => { g.fillStyle = '#fbe3ea'; U.rr(g, 0, 0, w, h, 14); g.fill(); U.sakura(g, 28, 30, 18, '#eb9db6', '#f6e3a0'); U.text(g, '春のさくらフェア', w / 2 + 16, 34, 22, F.round, '#c2476a', { weight: 900, maxW: w - 60 }); U.text(g, '期間限定', w / 2, 70, 26, F.round, '#d9718f', { weight: 900 }); });
  const rNew = A.inner.region(120, 60, (g, w, h) => { g.fillStyle = '#e8506a'; U.rr(g, 0, 0, w, h, 10); g.fill(); U.text(g, 'NEW!', w / 2, h / 2 + 2, 30, F.en, '#fff', { weight: 900 }); });
  const PLAN = {
    snacks: [[TPL.bagL], [TPL.bagM], [TPL.bagM, TPL.boxM], [TPL.bagS, TPL.boxS]],
    sweets: [[TPL.boxL], [TPL.boxM], [TPL.bagS, TPL.boxM], [TPL.boxS]],
    noodle: [[TPL.cupL], [TPL.cup], [TPL.retort, TPL.boxM], [TPL.bagM]],
    bread: [[TPL.bread], [TPL.bread], [TPL.boxM, TPL.bagS], [TPL.bagM, TPL.boxS]],
    daily: [[TPL.tissue], [TPL.detergent], [TPL.paste, TPL.mask], 'pegs'],
    grocery: [[TPL.bottleL], [TPL.canF], [TPL.boxM, TPL.retort], 'pegs'],
  };
  function pegRow(g, x0, x1, yHook, zBack, r, vars) {
    for (let x = x0 + 0.07; x < x1 - 0.06; x += 0.13) {
      G.add('stem', g, [x, yHook, zBack], [0.007, 0.17, 0.007], '#c9ced3', [Math.PI / 2, 0, 0]);
      const v = r.pick(vars), n = r.int(2, 4);
      for (let j = 0; j < n; j++) G.add('blister', g, [x, yHook - 0.14, zBack + 0.15 - j * 0.028], [0.092, 0.14, 0.012], white(r), [0, (r() - 0.5) * 0.08, (r() - 0.5) * 0.03], v);
    }
  }
  function gondola(cx, z0, z1, plans) {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    k.box(0.05, GH - 0.13, len, mPeg, [cx, FY + 0.13 + (GH - 0.13) / 2, cz]);
    k.box(0.12, 0.035, len + 0.04, mWhite, [cx, FY + GH + 0.017, cz]);
    const nm = Math.max(2, Math.round(len / 1.25)), ml = len / nm;
    for (let i = 0; i <= nm; i++) k.box(0.07, GH, 0.04, mWhite, [cx, FY + GH / 2, z0 + i * ml]);
    [-1, 1].forEach((sd, si) => {
      const g = S.k.group([cx, FY, cz], sd * Math.PI / 2); const kg = ctx.kit(g);
      kg.box(len, 0.13, 0.42, mBase, [0, 0.065, 0.245]);
      kg.box(len, 0.1, 0.012, mKick, [0, 0.05, 0.458]);
      for (let li = 1; li < 4; li++) {
        const y = LEV[li];
        kg.box(len - 0.01, 0.02, 0.4, mShelf, [0, y - 0.01, 0.245]);
        kg.box(len, 0.044, 0.014, li % 2 ? mTealI : mYelI, [0, y - 0.014, 0.448]);
        rail(kg, len, y - 0.014, 0.458);
        for (let i = 0; i <= nm; i++) kg.box(0.018, 0.07, 0.36, mMetal, [-len / 2 + i * ml, y - 0.055, 0.22]);
      }
      rail(kg, len, 0.08, 0.465);
      const plan = plans[si], r = ctx.rng(`kb.g|${cx}|${sd}`);
      for (let m2 = 0; m2 < nm; m2++) {
        const mx0 = -len / 2 + m2 * ml + 0.03, mx1 = -len / 2 + (m2 + 1) * ml - 0.03;
        for (let li = 0; li < 4; li++) {
          const lv = plan[li];
          if (lv === 'pegs') { pegRow(g, mx0, mx1, LEV[li] + 0.27, 0.04, r, [0, 1, 2, 3, 4, 5, 6, 7]); continue; }
          fill(g, mx0, mx1, LEV[li], 0.44, 0.06, lv, r, { maxH: (li < 3 ? LEV[li + 1] - LEV[li] : GH - LEV[li]) - 0.03 });
        }
      }
    });
    // front end cap (faces the entrance)
    {
      const ec = S.k.group([cx, FY, z1], 0); const ke = ctx.kit(ec), D2 = 0.34;
      for (const s of [-1, 1]) ke.box(0.03, GH, D2, mWhite, [s * 0.435, GH / 2, D2 / 2]);
      ke.box(0.84, GH - 0.13, 0.02, mPink, [0, 0.13 + (GH - 0.13) / 2, 0.012]);
      ke.box(0.87, 0.13, D2, mBase, [0, 0.065, D2 / 2]); ke.box(0.87, 0.1, 0.012, mKick, [0, 0.05, D2 + 0.002]);
      for (const y of [0.52, 0.9]) { ke.box(0.84, 0.02, D2 - 0.02, mShelf, [0, y - 0.01, D2 / 2]); ke.box(0.86, 0.044, 0.014, mPink, [0, y - 0.014, D2 - 0.002]); }
      ke.box(0.9, 0.3, 0.03, mPink, [0, GH + 0.2, 0.02]);
      S.card(rPOP, 0.6, 0.27, [0, GH + 0.2, 0.037], null, null, ke);
      S.card(rNew, 0.24, 0.12, [0.3, 1.2, D2 - 0.05], [0, -0.2, 0], null, ke);
      const r = ctx.rng('kb.ec' + cx);
      fill(ec, -0.41, 0.41, 0.13, D2 - 0.02, 0.03, [{ ...TPL.pet, vars: [10] }, { ...TPL.carton, vars: [7] }], r, { deep: 3 });
      fill(ec, -0.41, 0.41, 0.52, D2 - 0.02, 0.03, [{ ...TPL.boxM, vars: [12, 13] }], r, { deep: 3 });
      fill(ec, -0.41, 0.41, 0.9, D2 - 0.02, 0.03, [{ ...TPL.bagM, vars: [10] }, { ...TPL.boxS, vars: [13] }], r, { deep: 2, maxH: 0.3 });
    }
    // back end cap (thin peg display facing the coolers)
    {
      const bc = S.k.group([cx, FY, z0], Math.PI); const kb = ctx.kit(bc);
      kb.box(0.86, GH - 0.13, 0.02, mPeg, [0, 0.13 + (GH - 0.13) / 2, 0.01]);
      kb.box(0.86, 0.13, 0.16, mBase, [0, 0.065, 0.08]);
      const r = ctx.rng('kb.bc' + cx);
      for (const y of [0.55, 0.85, 1.15]) pegRow(bc, -0.43, 0.43, y + 0.2, 0.02, r, [0, 2, 3, 5, 6, 7]);
    }
    S.box(cx, cz + 0.07, 0.92, len + 0.54, -1, FY + GH + 0.4);
  }
  gondola(-2.65, -9.8, -4.6, [PLAN.snacks, PLAN.sweets]);
  gondola(-0.2, -9.8, -4.6, [PLAN.noodle, PLAN.bread]);
  gondola(2.3, -9.8, -4.6, [PLAN.daily, PLAN.grocery]);

  // hanging category signs (printed boards on wires)
  const catSign = (t, c) => A.inner.region(256, 64, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(0, 0, 18, h); g.fillRect(w - 18, 0, 18, h); U.text(g, t, w / 2, h / 2 + 2, 30, F.round, c, { weight: 900, maxW: w - 50 }); });
  for (const [t, c, x, z] of [['お菓子', '#e8506a', -1.45, -6.6], ['日用品・食品', TEAL, 1.05, -6.6], ['ドリンク', '#3f7fb5', 1.6, -10.5], ['お弁当・おにぎり', '#e9a23b', -3.6, -10.5]]) {
    const reg = catSign(t, c);
    k.box(1.12, 0.3, 0.02, mWhite, [x, 2.62, z - 0.005]);
    S.card(reg, 1.1, 0.28, [x, 2.62, z + 0.007]); S.card(reg, 1.1, 0.28, [x, 2.62, z - 0.017], [0, Math.PI, 0]);
    for (const dx of [-0.45, 0.45]) ctx.wires.add([S.world(x + dx, CY, z), S.world(x + dx, 2.77, z)], { width: 0.006, color: '#6d6a80' });
  }

  // ---------------- reach-in coolers (back wall): 8 glass doors
  {
    const x0 = -1.4, x1 = 4.6, n = 8, dw = (x1 - x0) / n, FZ = -11.02, zb = IZ0, cx = (x0 + x1) / 2, depth = FZ - zb;
    const sets = ['お茶', '紙パック', '水・炭酸', 'ジュース', 'スポーツ', '乳飲料', 'コーヒー', 'エナジー'];
    const mCab = M.inner('#dcdfe2', 0.3);
    k.box(x1 - x0 + 0.1, 0.2, depth + 0.04, mKick, [cx, FY + 0.1, (FZ + zb) / 2 + 0.02]);
    k.box(x1 - x0 + 0.1, 0.4, depth + 0.1, mCab, [cx, FY + 2.42, (FZ + zb) / 2 + 0.05]);
    for (const x of [x0 - 0.03, x1 + 0.03]) k.box(0.05, 2.62, depth + 0.1, mCab, [x, FY + 1.31, (FZ + zb) / 2 + 0.05]);
    k.plane(x1 - x0, 2.02, M.inner('#eef1f2', 0.52), [cx, FY + 1.21, zb + 0.012]);
    k.box(x1 - x0, 0.03, depth, M.inner('#c9ced3', 0.3), [cx, FY + 0.215, (FZ + zb) / 2]);
    const hReg = {};
    for (const nm of new Set(sets)) hReg[nm] = A.glow.region(128, 28, (g, w, h) => { g.fillStyle = TEAL; g.fillRect(0, 0, w, h); U.text(g, nm, w / 2, h / 2 + 1, 17, F.round, '#fff', { weight: 900 }); });
    const PETV = { 'お茶': [0, 1, 2, 11], '水・炭酸': [3, 4, 15, 10], 'ジュース': [5, 8, 13, 14], 'スポーツ': [7, 3, 12, 4], '乳飲料': [12, 6], 'コーヒー': [9, 6], 'エナジー': [10, 8] };
    const CANV = { '水・炭酸': [8, 7, 1], 'ジュース': [9, 6, 5, 14], 'コーヒー': [2, 3, 10, 11], 'エナジー': [4, 0, 1, 15, 12], 'スポーツ': [7, 8] };
    for (let i = 0; i < n; i++) {
      const xc = x0 + dw * (i + 0.5), nm = sets[i];
      const dg = S.k.group([xc, FY, FZ], 0); const kd = ctx.kit(dg);
      // door: frame, glass, handle with stand-offs, gasket strip
      const dh = 2.02, y0 = 0.2;
      kd.box(dw - 0.012, 0.055, 0.045, mDark, [0, y0 + 0.028, 0.03]); kd.box(dw - 0.012, 0.07, 0.045, mDark, [0, y0 + dh - 0.035, 0.03]);
      for (const s of [-1, 1]) kd.box(0.045, dh, 0.045, mDark, [s * (dw / 2 - 0.028), y0 + dh / 2, 0.03]);
      kd.plane(dw - 0.1, dh - 0.12, mGlass, [0, y0 + dh / 2, 0.035]).castShadow = false;
      const hs = i % 2 ? -1 : 1, hx = hs * (dw / 2 - 0.085);
      kd.cyl(0.013, 0.013, 0.78, mMetal, [hx, y0 + 1.05, 0.105], null, 8);
      for (const yy of [0.72, 1.38]) kd.cyl(0.008, 0.008, 0.06, mMetal, [hx, y0 + yy, 0.075], [Math.PI / 2, 0, 0], 6);
      S.card(hReg[nm], dw - 0.08, 0.18, [0, y0 + dh + 0.12, 0.105], null, null, kd);
      // shelves + drinks (behind the glass: z < 0)
      const r = ctx.rng('kb.cool' + i);
      for (let s = 0; s < 5; s++) {
        const y = y0 + 0.03 + s * 0.39;
        if (s > 0) { kd.box(dw - 0.05, 0.014, 0.62, mMetal, [0, y - 0.007, -0.36]); }
        kd.box(dw - 0.05, 0.03, 0.01, M.inner('#f7f5ef', 0.45), [0, y - 0.005, -0.045]);
        S.card(rRail, dw - 0.06, 0.028, [0, y - 0.005, -0.039], null, null, kd);
        const hMax = 0.36;
        let tp;
        if (nm === '乳飲料') tp = s < 2 ? [TPL.carton] : s < 4 ? [TPL.cartonS] : [{ ...TPL.pet, vars: PETV[nm] }];
        else if (nm === 'コーヒー' || nm === 'エナジー') tp = s === 0 ? [{ ...TPL.pet, vars: PETV[nm] }] : s < 3 ? [{ ...TPL.canL, vars: CANV[nm] }] : [{ ...TPL.can, vars: CANV[nm] }];
        else if (nm === 'ジュース') tp = s === 4 ? [{ ...TPL.carton, vars: [3, 4, 5] }] : s === 3 ? [{ ...TPL.can, vars: CANV[nm] }] : [{ ...TPL.pet, vars: PETV[nm] }];
        else if (nm === '水・炭酸') tp = s === 4 ? [{ ...TPL.can, vars: CANV[nm] }] : [{ ...TPL.pet, vars: PETV[nm] }];
        else if (nm === '紙パック') tp = s < 2 ? [{ ...TPL.bottleL, vars: [0, 2, 3] }] : s < 4 ? [{ ...TPL.carton, vars: [5, 6, 0] }] : [{ ...TPL.cartonS, vars: [0, 1, 2, 6] }];
        else if (nm === 'スポーツ' && s >= 3) tp = [{ ...TPL.can, vars: CANV[nm] }];
        else tp = [{ ...TPL.pet, vars: PETV[nm] }];
        fill(dg, -dw / 2 + 0.035, dw / 2 - 0.035, y + 0.004, -0.06, -0.5, tp, r, { maxH: hMax, deep: s < 3 ? 2 : 1 });
      }
    }
    for (let i = 1; i < n; i++) k.box(0.02, 2.02, 0.03, mLed, [x0 + dw * i, FY + 1.21, FZ - 0.06]);
    S.box(cx, (FZ + zb) / 2 + 0.06, x1 - x0 + 0.1, depth + 0.16, -1, FY + 2.62);
  }

  // ---------------- open chilled case: bento / onigiri / sandwiches / desserts
  {
    const x0 = -5.7, x1 = -1.6, z0 = IZ0, z1 = -11.1, cx = (x0 + x1) / 2, w = x1 - x0;
    k.box(w, 0.55, z1 - z0, mBody, [cx, FY + 0.275, (z0 + z1) / 2]);
    k.box(w, 0.09, 0.05, mMetal, [cx, FY + 0.5, z1 + 0.02]);
    for (let i = 0; i < 40; i++) k.box(0.05, 0.012, 0.03, mDark, [x0 + 0.06 + i * (w - 0.12) / 39, FY + 0.556, z1 - 0.02]);
    k.box(w, 1.55, 0.1, mBody, [cx, FY + 0.55 + 0.775, z0 + 0.05]);
    for (const x of [x0 + 0.025, x1 - 0.025]) k.box(0.05, 1.9, z1 - z0, mBody, [x, FY + 0.55 + 0.95 - 0.2, (z0 + z1) / 2]);
    k.box(w + 0.02, 0.22, 0.68, mTealI, [cx, FY + 2.12, z0 + 0.34]);
    const rOpenH = A.glow.region(360, 40, (g, W, Hh) => { g.fillStyle = TEAL; g.fillRect(0, 0, W, Hh); U.text(g, 'お弁当 · おにぎり · サンドイッチ', W / 2, Hh / 2 + 1, 22, F.round, '#fff', { weight: 900, maxW: W - 20 }); });
    S.card(rOpenH, 2.6, 0.2, [cx, FY + 2.12, z0 + 0.685]);
    k.box(w - 0.1, 0.02, 0.06, mLed, [cx, FY + 2.0, z0 + 0.6]);
    const shelves = [[0.98, 0.5], [1.34, 0.43], [1.7, 0.36]];
    for (const [y, d] of shelves) {
      k.box(w - 0.1, 0.02, d, M.inner('#dfe3e5', 0.4), [cx, FY + y - 0.01, z0 + 0.1 + d / 2]);
      k.box(w - 0.1, 0.035, 0.012, M.inner('#f7f5ef', 0.45), [cx, FY + y - 0.02, z0 + 0.1 + d + 0.004]);
      S.card(rRail, w - 0.12, 0.03, [cx, FY + y - 0.02, z0 + 0.1 + d + 0.011]);
      k.box(w - 0.14, 0.012, 0.04, mLed, [cx, FY + y - 0.03, z0 + 0.14 + d * 0.5]);
    }
    const g = S.k.group([cx, FY, 0], 0);
    const r = ctx.rng('kb.open2');
    fill(g, -w / 2 + 0.07, w / 2 - 0.07, 0.56, z1 - 0.04, z0 + 0.12, [{ kind: 'bento', w: [0.2, 0.22], h: 0.055, d: 0.16, vars: [0, 1, 2, 3, 4, 5, 6, 7], deep: 3, n: [2, 3], stack: 2 }], r);
    const sh = (i) => z0 + 0.1 + shelves[i][1];
    fill(g, -w / 2 + 0.07, w / 2 - 0.07, shelves[0][0] + 0.004, sh(0) - 0.01, z0 + 0.12, [{ kind: 'onigiri', w: 0.1, h: 0.092, d: 0.035, vars: [0, 1, 2, 3, 4, 5, 6, 7], deep: 5, n: [3, 4] }], r);
    fill(g, -w / 2 + 0.07, w / 2 - 0.07, shelves[1][0] + 0.004, sh(1) - 0.01, z0 + 0.12, [{ kind: 'sando', w: 0.13, h: 0.12, d: 0.055, vars: [0, 1, 2, 3], deep: 4, n: [2, 3] }], r);
    fill(g, -w / 2 + 0.07, w / 2 - 0.07, shelves[2][0] + 0.004, sh(2) - 0.01, z0 + 0.12, [{ ...TPL.boxS, vars: [12, 13, 5], deep: 4 }, { ...TPL.cartonS, vars: [0, 1, 6, 7] }], r);
    S.box(cx, (z0 + z1) / 2, w, z1 - z0 + 0.04, -1, FY + 2.25);
  }

  // ---------------- register counter
  {
    const x0 = -4.9, x1 = -4.2, z0 = -8.6, z1 = -4.2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = z1 - z0;
    k.box(x1 - x0, 0.96, len, mCounter, [cx, FY + 0.48, cz]);
    k.box(0.02, 0.1, len, mTealI, [x1 + 0.005, FY + 0.8, cz]);
    k.box(0.02, 0.035, len, mYelI, [x1 + 0.005, FY + 0.72, cz]);
    k.box(0.04, 0.1, len, mKick, [x1 - 0.02, FY + 0.05, cz]);
    k.rbox(x1 - x0 + 0.14, 0.05, len + 0.08, 0.02, mTop, [cx + 0.05, FY + 0.985, cz]);
    const ty = FY + 1.01;
    const rScreen = A.glow.region(96, 64, (g, w, h) => { g.fillStyle = '#dff1ee'; g.fillRect(0, 0, w, h); g.fillStyle = TEAL; g.fillRect(0, 0, w, 14); U.text(g, 'いらっしゃいませ', w / 2, 36, 11, F.sans, INK, { weight: 700 }); U.text(g, '¥ 0', w / 2, 54, 12, F.en, INK, { weight: 700 }); });
    const rCust = A.glow.region(96, 48, (g, w, h) => { g.fillStyle = '#10282a'; g.fillRect(0, 0, w, h); U.text(g, '合計', 20, 16, 12, F.sans, '#9ff0e0', { weight: 700 }); U.text(g, '¥498', w - 30, 30, 20, F.en, '#9ff0e0', { weight: 900 }); });
    const rPad = A.inner.region(64, 96, (g, w, h) => { g.fillStyle = '#3a3346'; g.fillRect(0, 0, w, h); g.fillStyle = '#9fd6e8'; g.fillRect(8, 8, w - 16, 26); for (let i = 0; i < 12; i++) { g.fillStyle = i === 11 ? '#5a9e58' : i === 9 ? '#d9463b' : '#d9d6ce'; U.rr(g, 9 + (i % 3) * 16, 42 + Math.floor(i / 3) * 13, 13, 10, 2); g.fill(); } });
    const rEM = A.glow.region(64, 64, (g, w, h) => { g.fillStyle = '#2f64b5'; U.rr(g, 0, 0, w, h, 10); g.fill(); g.strokeStyle = '#fbf8f0'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(24, 32, 8 + i * 8, -0.8, 0.8); g.stroke(); } });
    for (const z of [-5.9, -7.6]) {
      // cash drawer + POS body
      k.box(0.42, 0.11, 0.44, mDark, [cx - 0.08, ty + 0.055, z]);
      k.box(0.01, 0.03, 0.2, mMetal, [cx + 0.135, ty + 0.05, z]);
      k.rbox(0.3, 0.1, 0.34, 0.02, M.inner('#5d646c', 0.16), [cx - 0.1, ty + 0.16, z]);
      // clerk screen on a stand (faces -x)
      k.cyl(0.02, 0.02, 0.14, mDark, [cx - 0.12, ty + 0.27, z], null, 8);
      const sg = S.k.group([cx - 0.14, ty + 0.4, z], -Math.PI / 2); const ks = ctx.kit(sg);
      ks.box(0.34, 0.24, 0.035, mInk, [0, 0, 0], [-0.22, 0, 0]);
      S.card(rScreen, 0.3, 0.2, [0, 0.004, 0.019], [-0.22, 0, 0], null, ks);
      // customer display (faces +x) on a pole
      k.cyl(0.012, 0.012, 0.3, mDark, [cx + 0.02, ty + 0.36, z + 0.12], null, 6);
      const cg = S.k.group([cx + 0.03, ty + 0.54, z + 0.12], Math.PI / 2); const kc = ctx.kit(cg);
      kc.box(0.2, 0.11, 0.035, mInk, [0, 0, 0], [-0.1, 0, 0]);
      S.card(rCust, 0.18, 0.09, [0, 0, 0.019], [-0.1, 0, 0], null, kc);
      // card reader on swivel stand (faces +x)
      k.cyl(0.035, 0.045, 0.03, mDark, [cx + 0.24, ty + 0.015, z - 0.18], null, 10);
      const pg = S.k.group([cx + 0.24, ty + 0.05, z - 0.18], Math.PI / 2); const kp = ctx.kit(pg);
      kp.rbox(0.085, 0.17, 0.03, 0.01, mInk, [0, 0.07, 0], [-0.5, 0, 0]);
      S.card(rPad, 0.07, 0.13, [0, 0.075, 0.017], [-0.5, 0, 0], null, kp);
      // e-money pad, receipt printer (+ paper), scanner in cradle, coin tray
      k.box(0.12, 0.025, 0.12, mInk, [cx + 0.22, ty + 0.013, z + 0.2]);
      S.card(rEM, 0.1, 0.1, [cx + 0.22, ty + 0.027, z + 0.2], [-Math.PI / 2, 0, Math.PI / 2]);
      k.rbox(0.18, 0.13, 0.15, 0.02, M.inner('#e8e8e4', 0.34), [cx - 0.2, ty + 0.065, z - 0.3]);
      k.box(0.004, 0.06, 0.08, M.inner('#fbfbf8', 0.5), [cx - 0.1, ty + 0.14, z - 0.3], [0, 0, -0.3]);
      k.box(0.05, 0.06, 0.07, mDark, [cx + 0.04, ty + 0.03, z - 0.34]);
      const sc = S.k.group([cx + 0.04, ty + 0.08, z - 0.34], 0); const ksc = ctx.kit(sc);
      ksc.box(0.035, 0.11, 0.04, mInk, [0, 0.02, 0], [0, 0, 0.2]); ksc.box(0.06, 0.05, 0.07, mInk, [0.03, 0.08, 0], [0, 0, -0.4]);
      ksc.box(0.004, 0.03, 0.05, M.glow('#ff6a5a', 1.0), [0.062, 0.07, 0], [0, 0, -0.4]);
      k.box(0.16, 0.012, 0.12, M.inner('#b48a62', 0.3), [cx + 0.25, ty + 0.006, z + 0.02]);
    }
    // hot-snack warmer (glass case, two trays of individual fried snacks)
    {
      const z = -5.02, hw = 0.64, hd = 0.46, hh = 0.5, bx = cx + 0.02;
      k.box(hd, 0.06, hw, mMetal, [bx, ty + 0.03, z]);
      k.box(hd, 0.06, hw, mMetal, [bx, ty + hh - 0.03, z]);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.025, hh, 0.025, mMetal, [bx + dx * (hd / 2 - 0.012), ty + hh / 2, z + dz * (hw / 2 - 0.012)]);
      k.box(hd - 0.04, 0.012, hw - 0.04, mLamp, [bx, ty + hh - 0.065, z]);
      k.plane(hw - 0.04, hh - 0.12, M.glass({ opacity: 0.2 }), [bx + hd / 2, ty + hh / 2, z], [0, Math.PI / 2, 0]).castShadow = false;
      for (const s of [-1, 1]) k.plane(hd - 0.04, hh - 0.12, M.glass({ opacity: 0.2 }), [bx, ty + hh / 2, z + s * hw / 2], [0, 0, 0]).castShadow = false;
      k.box(0.02, hh - 0.08, hw - 0.04, M.inner('#e9e6de', 0.4), [bx - hd / 2 + 0.01, ty + hh / 2, z]);
      const hg = S.k.group([bx, ty, z], Math.PI / 2);
      const rs = ctx.rng('kb.hot');
      for (const [ly, items] of [[0.07, 'chicken'], [0.25, 'mixed']]) {
        ctx.kit(hg).box(hw - 0.06, 0.012, hd - 0.08, mMetal, [0, ly, 0], [-0.12, 0, 0]);
        for (let i = 0; i < 6; i++) {
          const x = -hw / 2 + 0.07 + i * (hw - 0.14) / 5;
          if (items === 'chicken') { for (let j = 0; j < 2; j++) G.add('blob', hg, [x + (rs() - 0.5) * 0.01, ly + 0.01 + j * 0.012, 0.07 - j * 0.12], [0.085, 0.045, 0.1], rs.pick(['#c98a4a', '#d99a50', '#b87a3a']), [0, rs() * 3, 0]); }
          else if (i < 2) { G.add('mcup', hg, [x, ly + 0.01, 0.04], [0.07, 0.08, 0.05], '#d9463b'); for (let j = 0; j < 3; j++) G.add('blob', hg, [x + (j - 1) * 0.018, ly + 0.08, 0.04], [0.03, 0.028, 0.03], '#c98a4a'); }
          else if (i < 4) { for (let j = 0; j < 2; j++) G.add('blob', hg, [x, ly + 0.01, 0.07 - j * 0.12], [0.08, 0.035, 0.06], '#d9a05a', [0, 0.3, 0]); }
          else { G.add('blob', hg, [x, ly + 0.01, 0.02], [0.05, 0.04, 0.16], '#e8c48a', [0, 0, 0]); G.add('blob', hg, [x, ly + 0.035, 0.02], [0.028, 0.028, 0.18], '#c9574a'); }
        }
        S.card(rRail, hw - 0.06, 0.02, [0, ly - 0.006, hd / 2 - 0.035], null, null, ctx.kit(hg));
      }
      const rHotS = A.glow.region(160, 30, (g, w, h) => { g.fillStyle = '#e8506a'; g.fillRect(0, 0, w, h); U.text(g, 'ホットスナック', w / 2, h / 2 + 1, 18, F.round, '#fff', { weight: 900 }); });
      S.card(rHotS, 0.5, 0.09, [bx + hd / 2 + 0.003, ty + hh - 0.03, z], [0, Math.PI / 2, 0]);
    }
    // 中華まん steamer (glass box, white buns)
    {
      const z = -6.75, bx = cx + 0.02, sw = 0.38, sd = 0.4, shh = 0.42;
      k.box(sd, 0.05, sw, mMetal, [bx, ty + 0.025, z]); k.box(sd, 0.04, sw, mMetal, [bx, ty + shh - 0.02, z]);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.02, shh, 0.02, mMetal, [bx + dx * (sd / 2 - 0.01), ty + shh / 2, z + dz * (sw / 2 - 0.01)]);
      k.box(sd - 0.04, shh - 0.08, sw - 0.04, M.glass({ opacity: 0.3 }), [bx, ty + shh / 2, z]).castShadow = false;
      const hg = S.k.group([bx, ty, z], Math.PI / 2);
      for (const ly of [0.06, 0.22]) { ctx.kit(hg).box(sw - 0.05, 0.01, sd - 0.06, mMetal, [0, ly, 0]); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) G.add('blob', hg, [-0.1 + i * 0.1, ly + 0.005, 0.07 - j * 0.12], [0.085, 0.06, 0.085], ly > 0.1 && i === 2 ? '#f2d0a0' : '#f4f1ea'); }
      const rMan = A.glow.region(120, 30, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9463b'; g.fillRect(0, 0, 10, h); U.text(g, '中華まん', w / 2 + 4, h / 2 + 1, 18, F.round, '#d9463b', { weight: 900 }); });
      S.card(rMan, 0.3, 0.075, [bx + sd / 2 + 0.003, ty + shh - 0.02, z], [0, Math.PI / 2, 0]);
    }
    // donut case
    {
      const z = -8.2;
      k.box(0.4, 0.02, 0.34, mMetal, [cx, ty + 0.01, z]);
      k.box(0.4, 0.3, 0.34, M.glass({ opacity: 0.22 }), [cx, ty + 0.17, z]).castShadow = false;
      for (let i = 0; i < 6; i++) k.mesh(new THREE.TorusGeometry(0.035, 0.016, 6, 12), M.inner(['#d99a4a', '#f7d3de', '#8a5a44', '#f2c230', '#f4ecd8', '#d99a4a'][i], 0.35), [cx - 0.1 + (i % 2) * 0.2, ty + 0.04 + Math.floor(i / 2) * 0.09, z - 0.08 + (i % 3) * 0.08], [Math.PI / 2, 0, 0]);
    }
    // self-serve coffee machine (faces the customers, +x)
    {
      const z = -4.45, bx = cx + 0.0;
      const cg = S.k.group([bx, ty, z], Math.PI / 2); const kc = ctx.kit(cg);
      kc.rbox(0.36, 0.64, 0.42, 0.03, M.inner('#3f3a44', 0.14), [0, 0.32, -0.02]);
      kc.box(0.3, 0.2, 0.02, M.inner('#2f2a35', 0.1), [0, 0.46, 0.2]);
      const rCof = A.glow.region(96, 64, (g, w, h) => { g.fillStyle = '#2f2a35'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9a23b'; U.rr(g, 6, 6, w - 12, 18, 4); g.fill(); U.text(g, 'HOT  ·  ICE', w / 2, 16, 11, F.en, '#fff', { weight: 900 }); const b = [['R', '#6fd0c4'], ['L', '#6fd0c4'], ['R', '#8fc3e8'], ['L', '#8fc3e8']]; b.forEach(([t, c], i) => { g.fillStyle = c; U.rr(g, 8 + i * 21, 32, 17, 22, 4); g.fill(); U.text(g, t, 16 + i * 21, 43, 12, F.en, '#2f2a35', { weight: 900 }); }); });
      S.card(rCof, 0.26, 0.17, [0, 0.46, 0.212], null, null, kc);
      kc.box(0.24, 0.2, 0.12, M.inner('#1f1c24', 0.05), [0, 0.2, 0.15]);
      kc.cyl(0.018, 0.012, 0.05, mMetal, [0, 0.28, 0.14], null, 8);
      kc.box(0.2, 0.015, 0.1, mMetal, [0, 0.105, 0.15]);
      for (let i = 0; i < 5; i++) kc.box(0.18, 0.004, 0.008, M.inner('#6d747c', 0.2), [0, 0.114, 0.11 + i * 0.02]);
      kc.box(0.2, 0.12, 0.2, M.glass({ opacity: 0.35, tint: '#6b4a37' }), [0, 0.7, -0.08]).castShadow = false;
      kc.box(0.18, 0.08, 0.18, M.inner('#4a2c1e', 0.1), [0, 0.68, -0.08]);
      kc.box(0.21, 0.015, 0.21, mInk, [0, 0.765, -0.08]);
      G.add('mcup', cg, [0, 0.115, 0.14], [0.08, 0.1, 0.08], '#f4f1e8');
    }
    // coffee side station at the counter end: cup stacks, lids, stirrers, sugar/milk, trash slot
    {
      const sx0 = -4.85, sx1 = -4.25, sz0 = -4.18, sz1 = -3.72, scx = (sx0 + sx1) / 2, scz = (sz0 + sz1) / 2;
      k.box(sx1 - sx0, 0.95, sz1 - sz0, mCounter, [scx, FY + 0.475, scz]);
      k.rbox(sx1 - sx0 + 0.04, 0.04, sz1 - sz0 + 0.04, 0.015, mTop, [scx, FY + 0.97, scz]);
      k.box(0.2, 0.06, 0.012, mInk, [scx + 0.12, FY + 0.8, sz1 + 0.002]);
      const st = FY + 0.99;
      for (const [x, z, n, c] of [[scx - 0.18, scz - 0.12, 12, '#f4f1e8'], [scx - 0.08, scz - 0.12, 10, '#f4f1e8'], [scx - 0.18, scz + 0.02, 9, '#e8d5c0'], [scx - 0.08, scz + 0.02, 11, '#dfe6ea']]) {
        k.cyl(0.05, 0.05, 0.3, M.glass({ opacity: 0.3 }), [x, st + 0.15, z], null, 12).castShadow = false;
        for (let i = 0; i < n; i++) G.add('mcup', S, [x, st + 0.01 + i * 0.022, z], [0.075, 0.095, 0.075], c);
      }
      for (let i = 0; i < 14; i++) G.add('cyl', S, [scx + 0.1, st + i * 0.006, scz - 0.12], [0.085, 0.005, 0.085], '#f4f1e8');
      k.cyl(0.03, 0.03, 0.12, M.inner('#b48a62', 0.3), [scx + 0.2, st + 0.06, scz - 0.12], null, 10);
      for (let i = 0; i < 9; i++) G.add('cyl6', S, [scx + 0.2 + Math.cos(i) * 0.015, st + 0.1, scz - 0.12 + Math.sin(i) * 0.015], [0.004, 0.1, 0.004], '#e8dcc6', [(i % 3 - 1) * 0.08, 0, (i % 2 - 0.5) * 0.12]);
      k.box(0.18, 0.06, 0.12, M.inner('#b48a62', 0.3), [scx + 0.14, st + 0.03, scz + 0.08]);
      for (let i = 0; i < 10; i++) G.add('pbox', S, [scx + 0.08 + (i % 5) * 0.028, st + 0.03, scz + 0.05 + Math.floor(i / 5) * 0.05], [0.022, 0.05, 0.03], white(rr), [0.2, 0, 0], i % 2 ? 15 : 9);
      S.box(scx, scz, sx1 - sx0 + 0.04, sz1 - sz0 + 0.04, -1, FY + 1.3);
    }
    S.box(cx + 0.04, cz, x1 - x0 + 0.12, len + 0.08, -1, FY + 1.05);
    const rRegi = A.inner.region(128, 48, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); U.text(g, 'レジ', w / 2, h / 2 + 2, 30, F.round, INK, { weight: 900 }); });
    k.box(0.02, 0.21, 0.52, mWhite, [x1 + 0.09, 2.62, -6.6]);
    S.card(rRegi, 0.5, 0.19, [x1 + 0.101, 2.62, -6.6], [0, Math.PI / 2, 0]);
    ctx.wires.add([S.world(x1 + 0.09, CY, -6.85), S.world(x1 + 0.09, 2.72, -6.85)], { width: 0.006, color: '#6d6a80' });
    ctx.wires.add([S.world(x1 + 0.09, CY, -6.35), S.world(x1 + 0.09, 2.72, -6.35)], { width: 0.006, color: '#6d6a80' });
  }

  // ---------------- back counter behind the clerks: microwaves, hot-water pot, upper shelves of small goods
  {
    const bx0 = IX0, bx1 = -5.36, z0 = -8.6, z1 = -4.2, bcx = (bx0 + bx1) / 2, cz = (z0 + z1) / 2, len = z1 - z0;
    k.box(bx1 - bx0, 0.92, len, mCounter, [bcx, FY + 0.46, cz]);
    k.box(bx1 - bx0 + 0.02, 0.035, len, mTop, [bcx + 0.01, FY + 0.935, cz]);
    for (let i = 0; i < 4; i++) { k.box(0.012, 0.8, len / 4 - 0.02, M.inner('#e6e3db', 0.32), [bx1 + 0.006, FY + 0.47, z0 + (i + 0.5) * len / 4]); k.box(0.02, 0.1, 0.02, mMetal, [bx1 + 0.015, FY + 0.75, z0 + (i + 0.5) * len / 4 + 0.35]); }
    const top = FY + 0.95;
    for (const z of [-7.9, -7.3]) {
      const mg = S.k.group([bcx + 0.02, top, z], Math.PI / 2); const km = ctx.kit(mg);
      km.rbox(0.52, 0.31, 0.4, 0.02, M.inner('#e8e8e4', 0.34), [0, 0.155, 0]);
      km.box(0.34, 0.22, 0.01, M.inner('#2f2a35', 0.1), [-0.06, 0.16, 0.2]);
      km.box(0.3, 0.18, 0.004, M.glass({ opacity: 0.3 }), [-0.06, 0.16, 0.207]).castShadow = false;
      km.box(0.1, 0.24, 0.01, M.inner('#d9d6ce', 0.3), [0.19, 0.16, 0.2]);
      km.box(0.06, 0.02, 0.006, M.glow('#9ff0c0', 0.9), [0.19, 0.24, 0.206]);
      km.box(0.02, 0.2, 0.03, mMetal, [0.12, 0.16, 0.215]);
      for (let i = 0; i < 6; i++) km.box(0.02, 0.014, 0.004, M.inner('#8f969d', 0.2), [0.17 + (i % 2) * 0.04, 0.2 - Math.floor(i / 2) * 0.035, 0.206]);
    }
    k.cyl(0.1, 0.11, 0.3, M.inner('#e8e8e4', 0.34), [bcx, top + 0.15, -6.5], null, 14);
    k.cyl(0.08, 0.1, 0.05, M.inner('#b8bdc2', 0.28), [bcx, top + 0.325, -6.5], null, 14);
    k.box(0.06, 0.04, 0.04, mDark, [bcx + 0.11, top + 0.2, -6.5]);
    for (let i = 0; i < 3; i++) k.cyl(0.05, 0.05, 0.1, M.inner('#f4f1e8', 0.45), [bcx, top + 0.05 + i * 0.1, -5.6], [0, 0, 0], 12);
    // upper open shelves with small boxes (medicine, prepaid cards, stationery)
    const ux = IX0 + 0.16;
    k.box(0.02, 0.92, len, M.inner('#e3e1da', 0.3), [IX0 + 0.01, FY + 1.96, cz]);
    for (const zz of [z0 + 0.01, z1 - 0.01]) k.box(0.3, 0.92, 0.02, M.inner('#e3e1da', 0.3), [ux, FY + 1.96, zz]);
    k.box(0.32, 0.03, len, mShelf, [ux + 0.01, FY + 1.5, cz]);
    const sg = S.k.group([ux + 0.02, FY, cz], Math.PI / 2);
    const r2 = ctx.rng('kb.back2');
    for (const [y, tp] of [[1.52, [TPL.boxS]], [1.8, [{ ...TPL.boxS, vars: [9, 10, 8] }]], [2.1, [{ kind: 'blister', w: 0.09, h: 0.13, d: 0.012, vars: [0, 1, 2, 5], deep: 4, n: [3, 5] }]]]) {
      if (y > 1.6) ctx.kit(sg).box(len - 0.02, 0.02, 0.28, mShelf, [0, y - 0.01, 0.0]);
      fill(sg, -len / 2 + 0.05, len / 2 - 0.05, y, 0.13, -0.12, tp, r2, { maxH: 0.26 });
    }
    k.box(0.3, 0.03, len, mShelf, [ux, FY + 2.4, cz]);
    S.box(bcx, cz, bx1 - bx0 + 0.04, len, -1, FY + 2.4);
  }

  // ---------------- back-room door (south wall) — frame, steel leaf, window, push/kick plates
  {
    const z = -10.25, x = IX0 + 0.01;
    const dg = S.k.group([x, FY, z], Math.PI / 2); const kd = ctx.kit(dg);
    kd.box(0.08, 2.12, 0.05, mMetal, [-0.47, 1.06, 0.02]); kd.box(0.08, 2.12, 0.05, mMetal, [0.47, 1.06, 0.02]); kd.box(1.02, 0.08, 0.05, mMetal, [0, 2.08, 0.02]);
    kd.box(0.86, 2.02, 0.04, M.inner('#b9c3c8', 0.28), [0, 1.01, 0.03]);
    kd.box(0.3, 0.3, 0.01, mMetal, [0.18, 1.55, 0.055]); kd.plane(0.24, 0.24, M.glass({ opacity: 0.45, frost: true }), [0.18, 1.55, 0.061]).castShadow = false;
    kd.box(0.1, 0.3, 0.006, M.inner('#dfe3e5', 0.4), [-0.3, 1.05, 0.053]);
    kd.box(0.8, 0.22, 0.006, M.inner('#dfe3e5', 0.4), [0, 0.13, 0.053]);
    const rStaff = A.inner.region(160, 48, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); U.text(g, 'STAFF ONLY', w / 2, 17, 20, F.en, INK, { weight: 900 }); U.text(g, '関係者以外立入禁止', w / 2, 36, 12, F.sans, '#d9463b', { weight: 700 }); });
    S.card(rStaff, 0.4, 0.12, [0.18, 1.85, 0.056], null, null, kd);
  }

  // ---------------- eat-in counter along the north window, stools, bins
  {
    const z0 = -7.6, z1 = -3.6, cz = (z0 + z1) / 2;
    k.rbox(0.48, 0.045, z1 - z0, 0.015, M.inner('#b48a62', 0.3), [5.54, FY + 1.0, cz]);
    for (const z of [z0 + 0.2, cz, z1 - 0.2]) k.box(0.04, 1.0, 0.04, mMetal, [5.72, FY + 0.5, z]);
    k.box(0.02, 0.4, z1 - z0, M.inner('#e6e3db', 0.32), [5.74, FY + 0.78, cz]);
    for (const z of [-4.2, -5.4, -6.6]) {
      k.cyl(0.17, 0.16, 0.06, M.inner(TEAL, 0.3), [5.0, FY + 0.73, z], null, 16);
      k.cyl(0.025, 0.025, 0.7, mMetal, [5.0, FY + 0.35, z], null, 8);
      k.cyl(0.2, 0.22, 0.03, mMetal, [5.0, FY + 0.015, z], null, 14);
      k.mesh(new THREE.TorusGeometry(0.13, 0.01, 5, 14), mMetal, [5.0, FY + 0.28, z], [Math.PI / 2, 0, 0]);
      S.cyl(5.0, z, 0.2, -1, FY + 0.76);
    }
    k.box(0.14, 0.12, 0.1, M.inner('#e8e4da', 0.3), [5.6, FY + 1.08, -5.0]);
    k.box(0.1, 0.02, 0.08, M.inner('#fbfbf8', 0.5), [5.6, FY + 1.15, -5.0]);
    const rEat = A.inner.region(160, 48, (g, w, h) => { g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h); g.fillStyle = TEAL; g.fillRect(0, 0, 10, h); U.text(g, 'イートインスペース', w / 2 + 4, h / 2 + 1, 17, F.sans, TEAL_D, { weight: 900, maxW: w - 20 }); });
    S.card(rEat, 0.6, 0.18, [gx - 0.012, FY + 2.2, -5.6], [0, -Math.PI / 2, 0]);
    S.box(5.55, cz, 0.5, z1 - z0, -1, FY + 1.05);
    // two bins (burnable / bottles) at the end of the counter
    for (const [z, c, t] of [[-7.8, '#e36b5d', 'もえる'], [-8.09, '#3f7fb5', 'びん・かん']]) {
      k.box(0.36, 0.78, 0.27, M.inner('#e3e1da', 0.3), [5.55, FY + 0.39, z]);
      k.box(0.02, 0.1, 0.18, M.inner('#3a3346', 0.1), [5.36, FY + 0.66, z]);
      const reg = A.inner.region(64, 32, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); U.text(g, t, w / 2, h / 2 + 1, 13, F.sans, '#fff', { weight: 900, maxW: w - 4 }); });
      S.card(reg, 0.2, 0.1, [5.365, FY + 0.5, z], [0, -Math.PI / 2, 0]);
    }
    S.box(5.55, -7.945, 0.38, 0.58, -1, FY + 0.8);
  }

  // ---------------- multimedia ticket terminal, ATM, copier (north-east corner)
  {
    // ticket / payment kiosk
    const tg = S.k.group([5.42, FY, -8.5], -Math.PI / 2); const kt = ctx.kit(tg);
    kt.rbox(0.5, 1.02, 0.42, 0.03, M.inner('#e6e8ea', 0.34), [0, 0.51, 0]);
    kt.box(0.5, 0.06, 0.5, M.inner(TEAL, 0.28), [0, 1.35, -0.02]);
    kt.box(0.46, 0.3, 0.1, M.inner('#e6e8ea', 0.34), [0, 1.14, 0.08], [-0.6, 0, 0]);
    const rKi = A.glow.region(128, 96, (g, w, h) => { g.fillStyle = '#e8f4f2'; g.fillRect(0, 0, w, h); g.fillStyle = TEAL; g.fillRect(0, 0, w, 20); U.text(g, 'チケット・各種お支払い', w / 2, 11, 11, F.sans, '#fff', { weight: 900, maxW: w - 6 }); [['コンサート', '#e8506a'], ['スポーツ', '#3f7fb5'], ['公共料金', '#5a9e58'], ['マルチコピー', '#e9a23b']].forEach(([t, c], i) => { g.fillStyle = c; U.rr(g, 6 + (i % 2) * 60, 28 + Math.floor(i / 2) * 32, 56, 26, 5); g.fill(); U.text(g, t, 34 + (i % 2) * 60, 41 + Math.floor(i / 2) * 32, 11, F.sans, '#fff', { weight: 900, maxW: 52 }); }); });
    S.card(rKi, 0.36, 0.26, [0, 1.15, 0.135], [-0.6, 0, 0], null, kt);
    kt.box(0.2, 0.02, 0.02, mInk, [0, 0.82, 0.211]); kt.box(0.12, 0.04, 0.02, mInk, [0.12, 0.95, 0.211]);
    kt.box(0.3, 0.08, 0.04, M.inner('#b8bdc2', 0.28), [0, 0.62, 0.22]);
    const rKs = A.inner.region(128, 32, (g, w, h) => { g.fillStyle = TEAL; g.fillRect(0, 0, w, h); U.text(g, 'マルチ端末', w / 2, h / 2 + 1, 18, F.sans, '#fff', { weight: 900 }); });
    S.card(rKs, 0.44, 0.055, [0, 1.35, 0.232], null, null, kt);
    S.box(5.42, -8.5, 0.5, 0.56, -1, FY + 1.4);
    // ATM
    const ag = S.k.group([5.45, FY, -10.9], -Math.PI / 2); const ka = ctx.kit(ag);
    ka.rbox(0.62, 1.55, 0.6, 0.03, M.inner('#c9ced3', 0.28), [0, 0.775, 0]);
    for (const s of [-1, 1]) ka.box(0.03, 0.7, 0.2, M.inner('#b8bdc2', 0.28), [s * 0.3, 1.1, 0.38]);
    ka.box(0.56, 0.36, 0.14, M.inner('#9aa1a8', 0.22), [0, 1.08, 0.33], [-0.35, 0, 0]);
    const rATMscr = A.glow.region(80, 64, (g, w, h) => { g.fillStyle = '#d6ecf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f7fb5'; g.fillRect(0, 0, w, 14); U.text(g, 'お取引を', w / 2, 32, 12, F.sans, INK, { weight: 700 }); U.text(g, 'お選びください', w / 2, 48, 11, F.sans, INK, { weight: 700 }); });
    S.card(rATMscr, 0.28, 0.22, [0, 1.13, 0.41], [-0.35, 0, 0], null, ka);
    S.card(atmPad(A, U), 0.11, 0.1, [0.2, 0.98, 0.44], [-1.0, 0, 0], null, ka);
    ka.box(0.12, 0.012, 0.02, mInk, [0.2, 1.24, 0.305]); ka.box(0.2, 0.05, 0.03, mInk, [-0.08, 0.86, 0.31]);
    ka.box(0.3, 0.1, 0.04, M.inner('#5d646c', 0.16), [0, 0.72, 0.31]);
    ka.box(0.62, 0.3, 0.62, M.inner('#3f7fb5', 0.28), [0, 1.7, 0]);
    const rATMh = A.glow.region(96, 40, (g, w, h) => { g.fillStyle = '#3f7fb5'; g.fillRect(0, 0, w, h); U.text(g, 'ATM', w / 2, h / 2 + 2, 28, F.en, '#fff', { weight: 900 }); });
    S.card(rATMh, 0.45, 0.19, [0, 1.7, 0.312], null, null, ka);
    S.box(5.45, -10.9, 0.64, 0.64, -1, FY + 1.9);
    // copier + coin unit
    const cg = S.k.group([5.35, FY, -9.65], -Math.PI / 2); const kc = ctx.kit(cg);
    kc.rbox(0.64, 0.86, 0.6, 0.02, M.inner('#e6e6e2', 0.34), [0, 0.43, 0]);
    for (let i = 0; i < 3; i++) { kc.box(0.58, 0.005, 0.01, M.inner('#9aa1a8', 0.22), [0, 0.2 + i * 0.2, 0.301]); kc.box(0.14, 0.02, 0.02, M.inner('#9aa1a8', 0.22), [0, 0.15 + i * 0.2, 0.31]); }
    kc.box(0.6, 0.12, 0.56, M.inner('#dcdcd8', 0.32), [0, 0.92, -0.02]);
    kc.box(0.52, 0.06, 0.4, M.inner('#cfcfca', 0.3), [0, 1.01, -0.04]);
    kc.box(0.36, 0.02, 0.24, M.inner('#f4f4f0', 0.4), [0, 1.05, -0.06], [0.08, 0, 0]);
    kc.box(0.4, 0.05, 0.16, M.inner('#5d646c', 0.16), [0, 0.9, 0.3], [0.5, 0, 0]);
    const rCp = A.glow.region(64, 32, (g, w, h) => { g.fillStyle = '#bfe3f4'; g.fillRect(0, 0, w, h); U.text(g, 'コピー', w / 2, h / 2 + 1, 13, F.sans, INK, { weight: 900 }); });
    S.card(rCp, 0.12, 0.06, [-0.08, 0.93, 0.385], [-1.07, 0, 0], null, kc);
    kc.box(0.3, 0.012, 0.22, M.inner('#f4f4f0', 0.4), [0.2, 0.62, 0.02]);
    kc.box(0.2, 0.5, 0.28, M.inner('#c9ced3', 0.28), [0.44, 0.95, 0.12]);
    kc.box(0.04, 0.012, 0.012, mInk, [0.44, 1.08, 0.265]); kc.box(0.05, 0.03, 0.012, M.glow('#ffd9a0', 0.9), [0.44, 1.0, 0.265]);
    S.box(5.35, -9.65, 0.66, 0.92, -1, FY + 1.1);
  }

  // ---------------- magazine rack along the front window (magazines face into the shop)
  {
    const x0 = 2.75, x1 = 5.55, z = -3.05, w = x1 - x0, cx = (x0 + x1) / 2;
    const rg = S.k.group([cx, FY, z], Math.PI); const kr = ctx.kit(rg); // local +z = into the shop
    kr.box(w, 1.05, 0.03, M.inner('#e3e1da', 0.3), [0, 0.525, -0.19]);
    kr.box(w, 0.12, 0.44, M.inner('#cfccc4', 0.25), [0, 0.06, 0]);
    for (const s of [-1, 1]) kr.box(0.03, 1.05, 0.44, M.inner('#d9d6ce', 0.3), [s * w / 2, 0.525, 0]);
    const r = ctx.rng('kb.mag2');
    const n = Math.floor(w / 0.235), sp = (w - 0.06) / n;
    for (let t = 0; t < 3; t++) {
      const y = 0.3 + t * 0.29, zz = 0.1 - t * 0.085;
      kr.box(w - 0.04, 0.015, 0.14, mShelf, [0, y - 0.008, zz], [0.25, 0, 0]);
      kr.box(w - 0.04, 0.05, 0.012, mTealI, [0, y + 0.015, zz + 0.075]);
      for (let i = 0; i < n; i++) {
        const v = r.int(0, 31), nn = r.int(2, 4);
        for (let j = 0; j < nn; j++) G.add('mag', rg, [-w / 2 + 0.03 + sp * (i + 0.5) + (r() - 0.5) * 0.01, y + 0.004, zz + 0.045 - j * 0.011], [0.2, 0.275, 0.009], white(r), [-0.26, (r() - 0.5) * 0.04, 0], v);
      }
    }
    for (let i = 0; i < n; i++) { const v = r.int(0, 31); for (let j = 0; j < 3; j++) G.add('cover', rg, [-w / 2 + 0.03 + sp * (i + 0.5), 0.12, 0.14 - j * 0.03], [0.13, 0.16, 0.028], white(r), [-0.1, 0, 0], v); }
    const rMagSign = A.inner.region(160, 40, (g, w2, h2) => { g.fillStyle = TEAL; g.fillRect(0, 0, w2, h2); U.text(g, '雑誌・コミック', w2 / 2, h2 / 2 + 1, 22, F.sans, '#fff', { weight: 700 }); });
    kr.box(0.84, 0.22, 0.02, mTealI, [0, 1.16, -0.18]);
    S.card(rMagSign, 0.8, 0.2, [0, 1.16, -0.168], null, null, kr);
    S.box(cx, z, w, 0.46, -1, FY + 1.05);
  }

  // ---------------- basket stack by the door
  {
    const bx = 2.36, bz = -3.08, mB = M.inner(TEAL, 0.3), mR = M.inner('#e9e6de', 0.34);
    k.box(0.5, 0.05, 0.38, mDark, [bx, FY + 0.025, bz]);
    for (let i = 0; i < 7; i++) {
      const g = S.k.group([bx, FY + 0.05 + i * 0.038, bz], 0); const kb = ctx.kit(g);
      const bw = 0.46, bd = 0.32, bh = 0.22;
      kb.box(bw - 0.06, 0.012, bd - 0.06, mB, [0, 0.006, 0]);
      for (let b = 0; b < 3; b++) {
        const y = 0.035 + b * 0.068, t = y / bh, ww = bw - 0.06 + t * 0.06, dd = bd - 0.06 + t * 0.06;
        kb.box(ww, 0.04, 0.01, mB, [0, y, dd / 2], [-0.12, 0, 0]); kb.box(ww, 0.04, 0.01, mB, [0, y, -dd / 2], [0.12, 0, 0]);
        kb.box(0.01, 0.04, dd, mB, [ww / 2, y, 0], [0, 0, 0.12]); kb.box(0.01, 0.04, dd, mB, [-ww / 2, y, 0], [0, 0, -0.12]);
      }
      kb.box(bw, 0.02, 0.018, mR, [0, bh, bd / 2]); kb.box(bw, 0.02, 0.018, mR, [0, bh, -bd / 2]);
      kb.box(0.018, 0.02, bd, mR, [bw / 2, bh, 0]); kb.box(0.018, 0.02, bd, mR, [-bw / 2, bh, 0]);
      if (i === 6) for (const s of [-1, 1]) kb.mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 10, Math.PI), mR, [s * 0.12, bh + 0.005, 0], [0, Math.PI / 2, s * 0.35]);
    }
    const rBk = A.inner.region(96, 32, (g, w, h) => { g.fillStyle = TEAL; g.fillRect(0, 0, w, h); U.text(g, 'かご', w / 2, h / 2 + 1, 18, F.round, '#fff', { weight: 900 }); });
    k.box(0.01, 0.6, 0.01, mMetal, [bx + 0.2, FY + 0.6, bz - 0.14]);
    S.card(rBk, 0.18, 0.06, [bx + 0.2, FY + 0.95, bz - 0.13]);
    S.box(bx, bz, 0.5, 0.38, -1, FY + 0.55);
  }

  // ---------------- seasonal sakura-fair display under the front window (south of the door)
  {
    const x0 = -5.5, x1 = -0.5, z = -3.0, cx = (x0 + x1) / 2, w = x1 - x0;
    const mD = M.inner('#f4f1ea', 0.34);
    k.box(w, 0.42, 0.44, mD, [cx, FY + 0.21, z]);
    k.box(w, 0.3, 0.2, mD, [cx, FY + 0.57, z + 0.11]);
    k.box(w, 0.02, 0.46, mPink, [cx, FY + 0.43, z]);
    k.box(w, 0.02, 0.22, mPink, [cx, FY + 0.73, z + 0.11]);
    const dg = S.k.group([cx, FY, z], Math.PI); // products face into the shop
    const r = ctx.rng('kb.sakura2');
    fill(dg, -w / 2 + 0.05, w / 2 - 0.05, 0.44, 0.2, 0.02, [{ ...TPL.pet, vars: [10], n: [3, 4] }, { ...TPL.boxM, vars: [12, 13] }, { ...TPL.bagM, vars: [10] }, { ...TPL.carton, vars: [7] }], r, { deep: 2, maxH: 0.26 });
    fill(dg, -w / 2 + 0.05, w / 2 - 0.05, 0.74, -0.03, -0.2, [{ ...TPL.boxS, vars: [12, 13] }, { ...TPL.canL, vars: [12] }], r, { deep: 2, maxH: 0.2 });
    k.cyl(0.07, 0.05, 0.36, M.inner('#e9e4d8', 0.35), [-0.8, FY + 0.75 + 0.18, z + 0.12], null, 12);
    const vg = S.k.group([-0.8, FY + 1.1, z + 0.12]);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3, len = 0.5 + (i % 3) * 0.12, tilt = 0.35 + (i % 2) * 0.2;
      const br = new THREE.Group(); br.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt); vg.add(br); const kb = ctx.kit(br);
      kb.cyl(0.006, 0.01, len, M.t('#6a5048'), [0, len / 2, 0], null, 5);
      for (let j = 0; j < 8; j++) G.add('bud', br, [(j % 2 ? 0.02 : -0.02), len * (0.3 + j * 0.085), (j % 3 - 1) * 0.02], [0.05, 0.042, 0.05], j % 3 ? '#f7d3de' : '#fbe9ef', [j, j * 2, 0]);
    }
    k.box(0.02, 0.3, 0.02, M.t('#b8bdc2'), [-3.0, FY + 0.87, z + 0.12]);
    S.card(rPOP, 0.5, 0.23, [-3.0, FY + 1.1, z + 0.108], [0, Math.PI, 0]);
    S.card(rPOP, 0.5, 0.23, [-3.0, FY + 1.1, z + 0.132]);
    S.box(cx, z - 0.02, w, 0.46, -1, FY + 0.9);
  }

  // ---------------- fire extinguisher by the door (moved clear of the baskets)
  {
    const ex = -0.25, ez = -2.97;
    k.cyl(0.075, 0.075, 0.42, M.t('#d9463b'), [ex, FY + 0.25, ez], null, 12);
    k.sphere(0.075, M.t('#d9463b'), [ex, FY + 0.46, ez], 10);
    k.box(0.05, 0.08, 0.05, M.t('#3a3346'), [ex, FY + 0.56, ez]);
    k.box(0.1, 0.02, 0.03, M.t('#3a3346'), [ex + 0.04, FY + 0.6, ez]);
    k.cyl(0.012, 0.012, 0.36, M.t('#3a3346'), [ex - 0.08, FY + 0.38, ez], [0, 0, 0.12], 5);
    k.cyl(0.08, 0.08, 0.03, M.t('#8a8e94'), [ex, FY + 0.03, ez], null, 12);
    S.cyl(ex, ez, 0.09, -1, FY + 0.6);
  }
}

// small keypad graphic shared by the ATM
let _pad = null;
function atmPad(A, U) {
  if (_pad) return _pad;
  _pad = A.inner.region(64, 64, (g, w, h) => { g.fillStyle = '#5d646c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { g.fillStyle = i === 11 ? '#5a9e58' : i === 9 ? '#d9463b' : '#e6e3db'; U.rr(g, 6 + (i % 3) * 18, 5 + Math.floor(i / 3) * 15, 15, 12, 2); g.fill(); } });
  return _pad;
}
