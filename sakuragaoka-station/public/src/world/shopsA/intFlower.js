// W2 花屋 はなのわ — interior, modelled: tiered wooden stands and tin buckets holding individual flower
// bunches (instanced stems, leaves and heads: roses, tulips, daisies, sweet peas, gypsophila, ranunculus,
// sakura branches, hydrangea pots), glass-door flower cooler with shelves of buckets, wrapping station
// (kraft roll dispenser with cutter, ribbon spool rack, tape, scissors, cut sheets, bouquet in a paper cone,
// register, message cards), ribbon rod, vase shelves, hanging dried bundles on a branch, watering cans,
// potted foliage (lib/foliage), pendant lamps with light pools, ceiling fixtures.
import * as THREE from 'three';
import { poolMat } from './intBooks.js';

const GREEN_D = '#4f7a5a', INK = '#3a3346';

export function buildFlowerInterior(ctx, C, S, D) {
  const { M, A, U, F, T, P } = C; const G = C.G; const k = S.k;
  const { FY, CI, IX0, IX1, IZ0, IZ1 } = D;
  G.setShop('W2', 0.42);
  const rr = ctx.rng('fl.int2');
  const mWood = M.inner('#9c7650', 0.25, { map: T.wood }), mWoodD = M.inner('#6d5038', 0.2, { map: T.wood }), mWoodL = M.inner('#b48a62', 0.3, { map: T.wood });
  const mTin = M.inner('#b9c0c6', 0.3), mTinD = M.inner('#9aa3ab', 0.25), mWater = M.inner('#7f9aa8', 0.25), mMetal = M.inner('#b8bdc2', 0.28), mInk = M.inner('#3a3346', 0.1);
  const pool = poolMat(ctx, C);
  const PAL = ['#e8506a', '#f2b5c8', '#fbf8f2', '#f2c230', '#c9b8e8', '#f08a4b', '#f7d3de', '#8e7cc3', '#d9546f', '#e8819c'];
  const GREENS = ['#5f8c4c', '#6f9a5a', '#4f7a4a'];

  // ---------------- flowers
  /** one bunch standing in a container whose water line is at (x, y, z); stems lean outward */
  function bunch(kind, base, x, y, z, cols, n = 9, spread = 0.07, len = [0.3, 0.44], o = {}) {
    const r = ctx.rng(`flb|${kind}|${x.toFixed(3)}|${z.toFixed(3)}|${y.toFixed(2)}`);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread, L = len[0] + r() * (len[1] - len[0]);
      const t = (o.lean ?? 0.18) * (0.3 + d / spread) + r() * 0.05, tz = -t * Math.cos(a), tx = t * Math.sin(a);
      const bx = x + Math.cos(a) * d * 0.4, bz = z + Math.sin(a) * d * 0.4, by = y - 0.12;
      const dir = [-Math.sin(tz), Math.cos(tz) * Math.cos(tx), Math.cos(tz) * Math.sin(tx)];
      const hx = bx + dir[0] * L, hy = by + dir[1] * L, hz = bz + dir[2] * L;
      const rot = [tx, 0, tz];
      G.add('stem', base, [bx, by, bz], [0.005, L, 0.005], r.pick(GREENS), rot);
      const c = cols && cols.length ? r.pick(cols) : '#fbf8f2';
      if (kind === 'rose') G.add('rose', base, [hx, hy - 0.01, hz], [0.05, 0.05, 0.05], c, rot);
      else if (kind === 'ranun') G.add('rose', base, [hx, hy - 0.01, hz], [0.06, 0.045, 0.06], c, [rot[0], r() * 3, rot[2]]);
      else if (kind === 'tulip') G.add('tulip', base, [hx, hy - 0.012, hz], [0.045, 0.065, 0.045], c, rot);
      else if (kind === 'daisy') { G.add('daisy', base, [hx, hy, hz], [0.065, 1, 0.065], c, rot); G.add('bud', base, [hx, hy - 0.004, hz], [0.02, 0.014, 0.02], '#f2c230', rot); }
      else if (kind === 'pea') { for (let j = 0; j < 3; j++) G.add('bud', base, [hx + (j - 1) * 0.014, hy - j * 0.022, hz], [0.028, 0.022, 0.024], c, [r(), r(), 0]); }
      else if (kind === 'gyp') { for (let j = 0; j < 7; j++) G.add('bud', base, [hx + (r() - 0.5) * 0.09, hy + (r() - 0.4) * 0.05, hz + (r() - 0.5) * 0.09], [0.014, 0.013, 0.014], '#fbf8f2'); }
      else if (kind === 'euca') { for (let j = 0; j < 7; j++) { const f = 0.3 + j * 0.1; G.add('leaf', base, [bx + dir[0] * L * f, by + dir[1] * L * f, bz + dir[2] * L * f], [0.055, 0.06, 1], j % 2 ? '#9fb8a0' : '#8aa892', [0.9, a + j * 2.3, 0.4]); } }
      if (i % 2 === 0 && kind !== 'euca') G.add('leaf', base, [bx + dir[0] * L * 0.45, by + dir[1] * L * 0.45, bz + dir[2] * L * 0.45], [0.028, 0.09, 1], r.pick(GREENS), [tx * 2 + 0.3, a, tz * 2]);
    }
  }
  function sakuraBranches(base, x, y, z, n = 4, L0 = 0.9) {
    const r = ctx.rng(`flsk|${x.toFixed(2)}|${z.toFixed(2)}`);
    for (let i = 0; i < n; i++) {
      const a = i * 2.1 + r(), t = 0.12 + r() * 0.12, L = L0 + r() * 0.3, tz = -t * Math.cos(a), tx = t * Math.sin(a);
      const dir = [-Math.sin(tz), Math.cos(tz) * Math.cos(tx), Math.cos(tz) * Math.sin(tx)];
      G.add('stem', base, [x, y - 0.2, z], [0.012, L, 0.012], '#6a5048', [tx, 0, tz]);
      for (let j = 0; j < 16; j++) {
        const f = 0.35 + j * 0.04, px = x + dir[0] * L * f + (r() - 0.5) * 0.06, py = y - 0.2 + dir[1] * L * f, pz = z + dir[2] * L * f + (r() - 0.5) * 0.06;
        G.add('bud', base, [px, py, pz], [0.045, 0.038, 0.045], j % 4 ? '#f7d3de' : '#fbe9ef', [r(), r(), 0]);
      }
    }
  }
  function bucket(x, y, z, kind, cols, o = {}) {
    const r = o.r ?? 0.11, h = o.h ?? 0.24;
    k.mesh(new THREE.LatheGeometry([[r * 0.78, 0], [r, h], [r * 1.04, h], [r * 1.04, h - 0.02], [r * 0.99, h - 0.02]].map(p => new THREE.Vector2(p[0], p[1])), 14), mTin, [x, y, z]);
    k.cyl(r * 0.78, r * 0.78, 0.005, mTinD, [x, y + 0.003, z], null, 12);
    k.cyl(r * 0.94, r * 0.94, 0.006, mWater, [x, y + h - 0.035, z], null, 12);
    for (const s of [-1, 1]) k.box(0.012, 0.03, 0.02, mTinD, [x + s * r, y + h - 0.04, z]);
    if (kind === 'sakura') sakuraBranches(S, x, y + h, z, 4, o.L ?? 0.8);
    else if (kind) bunch(kind, S, x, y + h - 0.03, z, cols, o.n ?? 9, r * 0.75, o.len);
  }
  function hydrangea(x, y, z, cols) {
    P.pot(S, x, y, z, { r: 0.15, h: 0.2, color: '#d9c9b0', plant: 'none' });
    C.shrub(S, x, y + 0.17, z, { r: 0.15, h: 0.13, green: '#5f8c5c', seed: 9 });
    const r = ctx.rng(`hyd2|${x}|${z}`);
    for (let c = 0; c < 4; c++) {
      const a = c * 1.57 + r(), cx = x + Math.cos(a) * 0.08, cz = z + Math.sin(a) * 0.08, cy = y + 0.3 + r() * 0.04, cc = r.pick(cols);
      for (let j = 0; j < 18; j++) { const u = r() * Math.PI * 2, v = Math.acos(1 - r() * 1.3); G.add('bud', S, [cx + Math.sin(v) * Math.cos(u) * 0.075, cy + Math.cos(v) * 0.06, cz + Math.sin(v) * Math.sin(u) * 0.075], [0.04, 0.03, 0.04], j % 3 ? cc : new THREE.Color(cc).multiplyScalar(0.88), [r(), r(), 0]); }
    }
  }
  const tagReg = {};
  const tag = (name, price, x, y, z, ry = 0) => {
    const key = name + price;
    if (!tagReg[key]) tagReg[key] = A.inner.region(120, 80, (g, w, h) => { g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9718f'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); U.text(g, name, w / 2, 26, 17, F.hand, INK, { weight: 400, maxW: w - 12 }); U.text(g, price, w / 2, 58, 21, F.hand, '#c2476a', { weight: 400, maxW: w - 12 }); }, { bg: '#fbf8ee' });
    G.add('stem', S, [x, y, z], [0.004, 0.24, 0.004], '#8a6446');
    S.card(tagReg[key], 0.11, 0.075, [x, y + 0.27, z + 0.004], [-0.15, ry, 0]);
  };

  // ---------------- ceiling fixtures, pendants, light pools
  {
    const mFix = M.inner('#f1ece0', 0.42), mLamp = M.glow('#fff0d8', 1.2);
    for (const z of [-4.2, -8.6]) for (const x of [-1.0, 1.0]) { k.box(1.7, 0.06, 0.28, mFix, [x, CI - 0.03, z]); k.box(1.6, 0.02, 0.2, mLamp, [x, CI - 0.066, z]); }
    for (const [x, z] of [[-1.2, -6.4], [1.2, -6.4], [0, -8.0]]) {
      const yb = FY + (z < -7 ? 1.95 : 2.15);
      ctx.wires.add([S.world(x, CI, z), S.world(x, yb + 0.2, z)], { width: 0.007, color: '#3a3640' });
      k.cyl(0.045, 0.045, 0.02, mInk, [x, CI - 0.01, z], null, 12);
      k.mesh(new THREE.LatheGeometry([[0.19, 0], [0.17, 0.05], [0.1, 0.15], [0.03, 0.2]].map(p => new THREE.Vector2(p[0], p[1])), 16), M.inner('#e9e2d0', 0.35, { side: 'double' }), [x, yb, z]);
      k.sphere(0.045, M.glow('#fff0d0', 1.6), [x, yb + 0.045, z], 10);
      k.cyl(0.17, 0.17, 0.004, M.glow('#ffe2b0', 1.25), [x, yb + 0.01, z], null, 16);
      const onTable = z < -7, ps = onTable ? 0.78 : 1.6; const p = k.plane(ps, ps, pool, [x, onTable ? FY + 0.909 : FY + 0.012, z], [-Math.PI / 2, 0, 0]); p.receiveShadow = false; ctx.noOutline(p);
    }
  }

  // ---------------- central round tiered stand (buckets on three rings + hydrangea on top)
  {
    const cx = 0.0, cz = -5.0;
    for (const [r, y] of [[0.75, 0.3], [0.5, 0.62], [0.28, 0.94]]) { k.cyl(r, r, 0.05, mWood, [cx, FY + y, cz], null, 20); k.mesh(new THREE.TorusGeometry(r, 0.012, 4, 24), mWoodD, [cx, FY + y + 0.025, cz], [Math.PI / 2, 0, 0]); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; k.box(0.05, 0.3, 0.05, mWoodD, [cx + Math.cos(a) * 0.68, FY + 0.15, cz + Math.sin(a) * 0.68]); }
    k.cyl(0.06, 0.06, 0.94, mWoodD, [cx, FY + 0.47, cz], null, 10);
    const kinds = ['tulip', 'rose', 'ranun', 'pea', 'daisy', 'tulip', 'gyp', 'rose'];
    for (const [r, y, n] of [[0.6, 0.325, 8], [0.36, 0.645, 5]]) for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + y * 3;
      bucket(cx + Math.cos(a) * r, FY + y, cz + Math.sin(a) * r, kinds[(i + n) % kinds.length], [rr.pick(PAL), rr.pick(PAL)], { r: 0.085, h: 0.2, n: 8, len: [0.26, 0.38] });
    }
    hydrangea(cx, FY + 0.965, cz, ['#7fa6d9', '#9aa9e0', '#b8a6de']);
    tag('春の花束', '¥1,500〜', cx + 0.3, FY + 0.965, cz + 0.12);
    S.cyl(cx, cz, 0.78, -1, FY + 1.1);
  }

  // ---------------- three-step wooden stand along the north wall
  {
    const x1 = IX1 - 0.04, z0 = -5.7, z1 = -2.95, cz = (z0 + z1) / 2, len = z1 - z0;
    const steps = [[0.3, x1 - 0.72], [0.56, x1 - 0.44], [0.82, x1 - 0.16]];
    for (const [h, x] of steps) {
      k.box(0.3, 0.035, len, mWood, [x, FY + h, cz]);
      for (const zz of [z0 + 0.04, cz, z1 - 0.04]) k.box(0.04, h, 0.04, mWoodD, [x, FY + h / 2, zz]);
    }
    for (const zz of [z0 + 0.02, z1 - 0.02]) k.box(0.9, 0.04, 0.03, mWoodD, [x1 - 0.44, FY + 0.12, zz]);
    const rows = [['rose', ['#d9546f', '#e8819c']], ['tulip', ['#f2c230', '#f6e3a0']], ['pea', ['#c9b8e8', '#f2b5c8', '#fbe9ef']], ['ranun', ['#f08a4b', '#f6c58a', '#f7d3de']], ['daisy', ['#fbf8f2']], ['tulip', ['#e8506a', '#f28db2']], ['gyp', ['#fbf8f2']], ['euca', ['#9fb8a0']], ['rose', ['#fbe9ef', '#f7d3de']]];
    let ri = 0;
    const names = { rose: ['バラ', '1本 ¥300'], tulip: ['チューリップ', '1本 ¥200'], pea: ['スイートピー', '¥350'], ranun: ['ラナンキュラス', '1本 ¥280'], daisy: ['マーガレット', '¥380'], gyp: ['かすみ草', '¥500'], euca: ['ユーカリ', '¥400'] };
    steps.forEach(([h, x], si) => {
      for (let i = 0; i < 4; i++) {
        const z = z0 + 0.35 + i * (len - 0.7) / 3, [kind, cols] = rows[ri++ % rows.length];
        bucket(x, FY + h + 0.018, z, kind, cols, { r: 0.1, h: 0.22, n: 9 });
        if ((i + si) % 2 === 0) tag(names[kind][0], names[kind][1], x - 0.13, FY + h + 0.02, z + 0.1, -Math.PI / 2);
      }
    });
    S.box(x1 - 0.44, cz, 0.92, len, -1, FY + 1.1);
  }
  // floor buckets along the south wall (tall stems) + sakura branches
  {
    const x = IX0 + 0.3;
    bucket(x, FY, -3.2, 'sakura', null, { r: 0.15, h: 0.42, L: 1.0 });
    bucket(x, FY, -3.62, 'euca', ['#9fb8a0'], { r: 0.13, h: 0.34, n: 8, len: [0.5, 0.7] });
    bucket(x, FY, -4.02, 'tulip', ['#fbf8f2', '#f7d3de'], { r: 0.12, h: 0.32, n: 12, len: [0.4, 0.55] });
    bucket(x, FY, -4.42, 'gyp', null, { r: 0.12, h: 0.32, n: 10, len: [0.4, 0.55] });
    tag('桜の枝', '1本 ¥600', x + 0.18, FY + 0.42, -3.3, Math.PI / 2);
    S.box(x, -3.8, 0.36, 1.6, -1, FY + 0.8);
  }

  // ---------------- flower cooler with glass doors (north wall, back)
  {
    const x = IX1 - 0.35, z0 = -9.8, z1 = -6.8, cz = (z0 + z1) / 2, w = z1 - z0;
    const g = S.k.group([x, FY, cz], -Math.PI / 2); const kg = ctx.kit(g); // local +z = into the shop (-x)
    const mCab = M.inner('#dfe3e5', 0.3), mFr = M.inner('#6d747c', 0.18);
    kg.box(w + 0.04, 0.16, 0.7, M.inner('#8f969d', 0.2), [0, 0.08, 0]);
    kg.box(w + 0.04, 0.3, 0.72, mCab, [0, 2.05, 0]);
    for (const s of [-1, 1]) kg.box(0.04, 2.2, 0.72, mCab, [s * (w / 2), 1.1, 0]);
    kg.box(w, 1.9, 0.02, M.inner('#eef1f2', 0.52), [0, 1.05, -0.34]);
    kg.box(w, 0.012, 0.01, M.glow('#f4f9ff', 1.2), [0, 1.88, 0.25]);
    for (let s = 0; s < 3; s++) {
      const y = 0.18 + s * 0.58;
      kg.box(w - 0.06, 0.02, 0.62, mMetal, [0, y, -0.02]);
      for (let i = 0; i < 6; i++) {
        const lx = -w / 2 + 0.28 + i * (w - 0.56) / 5, kinds = ['rose', 'tulip', 'ranun', 'pea', 'rose', 'daisy'], kind = kinds[(i + s * 2) % kinds.length];
        const bb = new THREE.Group(); bb.position.set(lx, y + 0.01, -0.05); g.add(bb); const kb = ctx.kit(bb);
        kb.cyl(0.08, 0.065, 0.2, mTin, [0, 0.1, 0], null, 12); kb.cyl(0.075, 0.075, 0.006, mWater, [0, 0.17, 0], null, 12);
        bunch(kind, bb, 0, 0.17, 0, [PAL[(i * 3 + s) % PAL.length], PAL[(i + s * 5) % PAL.length]], 7, 0.05, [0.24, 0.32], { lean: 0.12 });
      }
    }
    const dg = new THREE.Group(); dg.position.set(0, 0, 0.36); g.add(dg); const kd = ctx.kit(dg);
    for (const s of [-1, 1]) {
      const cx = s * w / 4;
      kd.box(w / 2 - 0.02, 0.05, 0.04, mFr, [cx, 0.19, 0]); kd.box(w / 2 - 0.02, 0.06, 0.04, mFr, [cx, 1.88, 0]);
      for (const e of [-1, 1]) kd.box(0.045, 1.72, 0.04, mFr, [cx + e * (w / 4 - 0.03), 1.035, 0]);
      kd.plane(w / 2 - 0.1, 1.64, ctx.mat.glass({ opacity: 0.06, streaks: false, tint: '#c9d6de' }), [cx, 1.035, 0.005]).castShadow = false;
      kd.cyl(0.012, 0.012, 0.6, mMetal, [cx - s * (w / 4 - 0.1), 1.05, 0.06], null, 8);
      for (const yy of [0.8, 1.3]) kd.cyl(0.007, 0.007, 0.05, mMetal, [cx - s * (w / 4 - 0.1), yy, 0.035], [Math.PI / 2, 0, 0], 6);
    }
    const rCool = A.glow.region(200, 32, (gg, ww, hh) => { gg.fillStyle = GREEN_D; gg.fillRect(0, 0, ww, hh); U.text(gg, 'フラワーキーパー  鮮度保持中', ww / 2, hh / 2 + 1, 15, F.round, '#fbf8f0', { weight: 900, maxW: ww - 10 }); });
    S.card(rCool, 1.4, 0.2, [0, 2.05, 0.365], null, null, kg);
    S.box(x, cz, 0.74, w + 0.08, -1, FY + 2.2);
  }

  // ---------------- wrapping station (worktable)
  {
    const cx = 0.0, cz = -8.0, w = 2.2, d = 0.8, ty = FY + 0.905;
    k.box(w, 0.05, d, mWoodL, [cx, FY + 0.88, cz]);
    k.box(w - 0.1, 0.8, d - 0.1, M.inner('#8a6446', 0.22, { map: T.wood }), [cx, FY + 0.43, cz]);
    for (let i = 0; i < 3; i++) k.box(w - 0.14, 0.012, 0.01, mWoodD, [cx, FY + 0.2 + i * 0.25, cz + d / 2 - 0.045]);
    S.box(cx, cz, w, d, -1, FY + 0.95);
    // kraft + print paper rolls on a dispenser across the back edge, with cutter bar
    const rx0 = cx - 1.0, rx1 = cx + 0.1, rz = cz - d / 2 + 0.12;
    for (const x of [rx0, rx1]) { k.box(0.03, 0.34, 0.2, mWoodD, [x, ty + 0.17, rz]); }
    [['#c9a57a', 0.1], ['#f7d3de', 0.22]].forEach(([c, y], i) => {
      k.cyl(0.06, 0.06, rx1 - rx0 - 0.04, M.inner(c, 0.34), [(rx0 + rx1) / 2, ty + y + 0.06, rz + (i ? 0.02 : -0.02)], [0, 0, Math.PI / 2], 16);
      k.cyl(0.02, 0.02, rx1 - rx0 + 0.02, mWoodD, [(rx0 + rx1) / 2, ty + y + 0.06, rz + (i ? 0.02 : -0.02)], [0, 0, Math.PI / 2], 8);
    });
    k.box(rx1 - rx0 - 0.04, 0.004, 0.36, M.inner('#c9a57a', 0.34), [(rx0 + rx1) / 2, ty + 0.005, rz + 0.25]);
    k.box(rx1 - rx0 + 0.02, 0.02, 0.03, mMetal, [(rx0 + rx1) / 2, ty + 0.012, rz + 0.08]);
    // cut sheets fanned + cellophane
    k.box(0.5, 0.004, 0.38, M.inner('#cfe0c8', 0.35), [cx + 0.45, ty + 0.002, cz + 0.12], [0, 0.35, 0]);
    k.box(0.46, 0.003, 0.36, M.inner('#f7d3de', 0.35), [cx + 0.42, ty + 0.006, cz + 0.1], [0, -0.1, 0]);
    k.box(0.45, 0.002, 0.34, M.glass({ opacity: 0.3 }), [cx + 0.44, ty + 0.009, cz + 0.08], [0, 0.2, 0]).castShadow = false;
    // bouquet in progress: paper cone with flowers
    {
      const bg = S.k.group([cx - 0.35, ty + 0.125, cz + 0.18], 0); bg.rotation.set(0, 0.4, Math.PI / 2 - 0.12);
      G.add('cone', bg, [0, -0.22, 0], [0.24, 0.4, 0.2], '#e9dcc0', [Math.PI, 0, 0]);
      G.add('cone', bg, [0, -0.2, 0], [0.22, 0.36, 0.18], '#f7d3de', [Math.PI, 0.7, 0]);
      bunch('rose', bg, 0, -0.02, 0, ['#f2b5c8', '#fbe9ef', '#e8819c'], 7, 0.05, [0.12, 0.2], { lean: 0.3 });
      bunch('gyp', bg, 0, -0.02, 0, null, 4, 0.06, [0.14, 0.2], { lean: 0.35 });
      G.add('ring', bg, [0, -0.2, 0], [0.09, 0.2, 0.09], '#e8506a');
    }
    // ribbon spool rack
    {
      const x0 = cx + 0.55, x1 = cx + 1.02, z = cz - 0.22;
      for (const x of [x0, x1]) k.box(0.02, 0.26, 0.08, mWoodD, [x, ty + 0.13, z]);
      for (const [y, dz] of [[0.09, 0.0], [0.21, 0.0]]) {
        k.cyl(0.006, 0.006, x1 - x0, mMetal, [(x0 + x1) / 2, ty + y, z + dz], [0, 0, Math.PI / 2], 6);
        for (let i = 0; i < 6; i++) { const c = PAL[(i + Math.round(y * 20)) % PAL.length], sx = x0 + 0.05 + i * 0.07; k.cyl(0.035, 0.035, 0.028, M.inner(c, 0.32), [sx, ty + y, z + dz], [0, 0, Math.PI / 2], 12); k.box(0.024, 0.08, 0.002, M.inner(c, 0.32), [sx, ty + y - 0.07, z + dz + 0.036], [0.1, 0, 0]); }
      }
    }
    // tape dispenser, scissors, register, message cards
    k.rbox(0.12, 0.06, 0.05, 0.015, M.inner('#e8506a', 0.3), [cx + 0.2, ty + 0.03, cz - 0.28]);
    k.cyl(0.022, 0.022, 0.02, M.glass({ opacity: 0.45 }), [cx + 0.18, ty + 0.055, cz - 0.28], [Math.PI / 2, 0, 0], 10).castShadow = false;
    {
      const sg = S.k.group([cx + 0.1, ty + 0.006, cz - 0.08], 0.6); const ks = ctx.kit(sg);
      ks.box(0.14, 0.005, 0.012, mMetal, [0.06, 0, 0.01], [0, 0.12, 0]); ks.box(0.14, 0.005, 0.012, mMetal, [0.06, 0, -0.01], [0, -0.12, 0]);
      for (const s of [-1, 1]) ks.mesh(new THREE.TorusGeometry(0.02, 0.006, 4, 10), M.inner('#e8506a', 0.3), [-0.03, 0, s * 0.018], [Math.PI / 2, 0, 0]);
    }
    {
      const rg = S.k.group([cx + 0.82, ty, cz + 0.2], Math.PI); const kr = ctx.kit(rg);
      kr.rbox(0.3, 0.09, 0.28, 0.015, M.inner('#e6e4dc', 0.34), [0, 0.045, 0]);
      kr.box(0.26, 0.012, 0.13, M.inner('#9aa1a8', 0.22), [0, 0.1, 0.05], [0.25, 0, 0]);
      for (let i = 0; i < 12; i++) kr.box(0.03, 0.01, 0.022, M.inner('#f4f1e8', 0.4), [-0.09 + (i % 4) * 0.06, 0.112 + Math.floor(i / 4) * 0.007, 0.02 + Math.floor(i / 4) * 0.03], [0.25, 0, 0]);
      kr.box(0.14, 0.08, 0.03, mInk, [0, 0.16, -0.1], [-0.25, 0, 0]);
      const rDisp = A.glow.region(64, 24, (g, ww, hh) => { g.fillStyle = '#1f2a24'; g.fillRect(0, 0, ww, hh); U.text(g, '¥ 2,200', ww / 2, hh / 2 + 1, 14, F.en, '#9ff0a0', { weight: 900 }); });
      S.card(rDisp, 0.12, 0.05, [0, 0.16, -0.084], [-0.25, 0, 0], null, kr);
      S.card(rDisp, 0.12, 0.05, [0, 0.16, -0.117], [-0.25, Math.PI, 0], null, kr);
    }
    const rCard = A.inner.region(64, 48, (g, ww, hh) => { g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, ww, hh); U.sakura(g, 12, 12, 7, '#f2b5c8'); U.text(g, 'Thank you', ww / 2, 30, 11, F.hand, '#c2476a', { weight: 400 }); });
    k.box(0.16, 0.05, 0.06, mWoodD, [cx - 0.85, ty + 0.025, cz + 0.28]);
    for (let i = 0; i < 4; i++) S.card(rCard, 0.07, 0.05, [cx - 0.91 + i * 0.04, ty + 0.07, cz + 0.28 + (i % 2) * 0.01], [-0.2, 0, 0]);
    const rWrap = A.inner.region(120, 72, (g, ww, hh) => { g.fillStyle = '#fbe3ea'; U.rr(g, 0, 0, ww, hh, 10); g.fill(); U.text(g, 'ラッピング', ww / 2, 24, 18, F.hand, '#c2476a', { weight: 400 }); U.text(g, '無料です♪', ww / 2, 50, 18, F.hand, INK, { weight: 400 }); });
    S.card(rWrap, 0.2, 0.12, [cx + 0.35, ty + 0.09, cz + 0.38], [-0.2, 0, 0]);
    k.box(0.2, 0.01, 0.06, mWoodL, [cx + 0.35, ty + 0.005, cz + 0.36]);
  }

  // ---------------- wrapping-paper roll rack on the south wall (real rolls + hanging sheets)
  {
    const x = IX0 + 0.22, z0 = -7.2, z1 = -4.8, cz = (z0 + z1) / 2;
    for (const z of [z0, z1]) k.box(0.06, 1.9, 0.06, mWoodD, [x, FY + 0.95, z]);
    for (const y of [0.1, 1.88]) k.box(0.3, 0.04, z1 - z0, mWoodD, [x, FY + y, cz]);
    ['#c9a57a', '#f7d3de', '#e9e2d0', '#cfe0c8', '#bfe3f4', '#f6e3a0'].forEach((c, i) => {
      const y = FY + 0.72 + i * 0.2, xx = x + (i % 2) * 0.08;
      k.cyl(0.055, 0.055, z1 - z0 - 0.12, M.inner(c, 0.32), [xx, y, cz], [Math.PI / 2, 0, 0], 16);
      k.cyl(0.018, 0.018, z1 - z0 - 0.02, mWoodD, [xx, y, cz], [Math.PI / 2, 0, 0], 8);
      if (i % 2 === 0) k.box(0.004, 0.42, z1 - z0 - 0.16, M.inner(c, 0.32, { side: 'double' }), [xx + 0.055, y - 0.22, cz]);
    });
    S.box(x, cz, 0.32, z1 - z0, -1, FY + 2.0);
  }

  // ---------------- back wall: ribbon rod, vase shelves, watering can, lesson poster
  {
    const z = IZ0 + 0.12;
    k.cyl(0.012, 0.012, 2.7, mMetal, [0, FY + 1.55, z], [0, 0, Math.PI / 2], 8);
    for (const s of [-1, 1]) k.box(0.03, 0.08, 0.12, mMetal, [s * 1.3, FY + 1.55, z - 0.05]);
    for (let i = 0; i < 11; i++) { const c = PAL[i % PAL.length], x = -1.2 + i * 0.24; k.cyl(0.055, 0.055, 0.03, M.inner(c, 0.32), [x, FY + 1.55, z], [0, 0, Math.PI / 2], 14); k.cyl(0.02, 0.02, 0.032, mWoodD, [x, FY + 1.55, z], [0, 0, Math.PI / 2], 8); k.box(0.025, 0.32, 0.002, M.inner(c, 0.32, { side: 'double' }), [x, FY + 1.38, z + 0.056], [0.05, 0, 0]); }
    const vases = [[[0.04, 0], [0.05, 0.02], [0.05, 0.2], [0.035, 0.24], [0.04, 0.26]], [[0.03, 0], [0.06, 0.05], [0.055, 0.12], [0.02, 0.18], [0.025, 0.2]], [[0.05, 0], [0.055, 0.14], [0.06, 0.15]], [[0.02, 0], [0.045, 0.06], [0.05, 0.1], [0.015, 0.22], [0.02, 0.24]]];
    for (const y of [FY + 2.05, FY + 2.5]) { k.box(2.8, 0.035, 0.28, mWoodL, [0, y, IZ0 + 0.14]); for (const x of [-1.2, 0, 1.2]) k.box(0.03, 0.12, 0.2, mMetal, [x, y - 0.08, IZ0 + 0.1], [0.5, 0, 0]); }
    for (let i = 0; i < 10; i++) {
      const x = -1.3 + i * 0.29, y = FY + (i % 2 ? 2.5 : 2.05) + 0.018, prof = vases[i % vases.length];
      const c = rr.pick(['#e9e4d8', '#bfd4d9', '#d9c9b0', '#f7d3de', '#9fb6c8', '#6f8455']);
      k.mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 14), M.inner(c, 0.35), [x, y, IZ0 + 0.15]);
      const top = prof[prof.length - 1][1];
      if (i % 3 === 0) bunch(rr.pick(['tulip', 'rose', 'daisy']), S, x, y + top, IZ0 + 0.15, [rr.pick(PAL)], 3, 0.015, [0.14, 0.2], { lean: 0.12 });
    }
    // green watering can on the lower shelf
    const wg = S.k.group([1.25, FY + 2.068, IZ0 + 0.15], 0.3); const kw = ctx.kit(wg);
    kw.cyl(0.07, 0.08, 0.16, M.inner('#6fa8a0', 0.3), [0, 0.08, 0], null, 14);
    kw.cyl(0.008, 0.014, 0.22, M.inner('#6fa8a0', 0.3), [0.12, 0.13, 0], [0, 0, -0.9], 8);
    kw.cyl(0.02, 0.012, 0.03, M.inner('#6fa8a0', 0.3), [0.21, 0.2, 0], [0, 0, -0.9], 8);
    kw.mesh(new THREE.TorusGeometry(0.07, 0.01, 4, 12, Math.PI), M.inner('#6fa8a0', 0.3), [-0.02, 0.16, 0], [0, 0, 0.2]);
    const rLesson = A.inner.region(160, 120, (g, w, h) => {
      g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fb58a'; g.fillRect(0, 0, w, 30);
      U.text(g, 'フラワーレッスン', w / 2, 16, 18, F.round, '#fbf8ee', { weight: 900, maxW: w - 10 });
      U.text(g, '毎月 第2土曜日', w / 2, 52, 16, F.round, GREEN_D, { weight: 700 });
      U.text(g, '14:00〜 ¥2,500', w / 2, 76, 16, F.round, '#c2476a', { weight: 700 });
      for (let i = 0; i < 4; i++) U.sakura(g, 24 + i * 38, 102, 9, ['#f2b5c8', '#f2c230', '#c9b8e8', '#e8819c'][i], '#fbf8ee');
    });
    k.box(0.02, 0.36, 0.46, mWoodD, [IX1 - 0.01, FY + 1.6, -6.25]);
    S.card(rLesson, 0.42, 0.32, [IX1 - 0.022, FY + 1.6, -6.25], [0, -Math.PI / 2, 0]);
  }

  // ---------------- dried flower bundles hanging head-down from a branch
  {
    const z = -5.8, y = CI - 0.35, x0 = -1.15, x1 = 1.15;
    const pts = [[x0, y + 0.02], [-0.4, y - 0.02], [0.35, y + 0.01], [x1, y - 0.03]];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); k.cyl(0.018, 0.022, len, M.inner('#7a5a44', 0.2), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [0, 0, Math.PI / 2 + Math.atan2(b[1] - a[1], b[0] - a[0])], 7); }
    for (const x of [x0 + 0.1, x1 - 0.1]) ctx.wires.add([S.world(x, y, z), S.world(x, CI, z)], { width: 0.005, color: '#6d6a80' });
    const dried = [['rose', ['#b86a6a', '#a8585a']], ['gyp', null], ['pea', ['#c9b8a0', '#d9b8a0']], ['daisy', ['#e8dcc0']], ['rose', ['#d9b8a0', '#c98a7a']], ['euca', ['#a8b8a0']], ['pea', ['#a07890', '#b890a0']]];
    dried.forEach(([kind, cols], i) => {
      const x = x0 + 0.18 + i * (x1 - x0 - 0.36) / (dried.length - 1);
      const bg = new THREE.Group(); bg.position.set(x, y - 0.06, z); bg.rotation.x = Math.PI; S.g.add(bg);
      ctx.wires.add([S.world(x, y, z), S.world(x, y - 0.06, z)], { width: 0.004, color: '#a88a60' });
      G.add('ring', bg, [0, -0.02, 0], [0.04, 0.12, 0.04], '#c9a57a');
      bunch(kind, bg, 0, 0.1, 0, cols || ['#e8dcc0'], 6, 0.025, [0.2, 0.28], { lean: 0.1 });
    });
  }

  // ---------------- floor: galvanised watering can + stacked terracotta pots + bag of soil by the cooler
  {
    const wg = S.k.group([1.9, FY, -10.5], -0.6); const kw = ctx.kit(wg);
    kw.cyl(0.12, 0.13, 0.28, mTin, [0, 0.14, 0], null, 16);
    kw.cyl(0.012, 0.022, 0.38, mTin, [0.2, 0.22, 0], [0, 0, -0.95], 8);
    kw.cyl(0.035, 0.02, 0.04, mTinD, [0.35, 0.34, 0], [0, 0, -0.95], 10);
    kw.mesh(new THREE.TorusGeometry(0.1, 0.014, 5, 14, Math.PI), mTinD, [-0.02, 0.28, 0], [0, 0, 0.1]);
    S.cyl(1.9, -10.5, 0.2, -1, FY + 0.4);
    for (let i = 0; i < 5; i++) k.mesh(new THREE.LatheGeometry([[0.07, 0], [0.1, 0.12], [0.11, 0.12], [0.11, 0.14], [0.1, 0.14]].map(p => new THREE.Vector2(p[0], p[1])), 14), M.inner('#c7805d', 0.3, { side: 'double' }), [-2.55, FY + i * 0.035, -10.6]);
    k.rbox(0.36, 0.14, 0.5, 0.05, M.inner('#6b8a5a', 0.25), [-2.1, FY + 0.07, -10.62], [0, 0.3, 0]);
    S.box(-2.35, -10.6, 0.8, 0.5, -1, FY + 0.3);
  }

  // ---------------- potted foliage on the north-wall shelf above the stand
  {
    const x = IX1 - 0.14, z0 = -5.4, z1 = -3.2;
    k.box(0.26, 0.035, z1 - z0, mWoodL, [x, FY + 1.9, (z0 + z1) / 2]);
    for (const zz of [z0 + 0.2, z1 - 0.2]) k.box(0.03, 0.2, 0.03, mWoodD, [IX1 - 0.03, FY + 1.8, zz]);
    const pal = [['#f2b5c8', '#fbe9ef'], ['#f1e3b0', '#f2c230'], ['#c9b8e8', '#fbf8f2'], ['#e8506a', '#f7d3de']];
    for (let i = 0; i < 6; i++) {
      const zz = z0 + 0.2 + i * (z1 - z0 - 0.4) / 5;
      if (i % 2) P.pot(S, x, FY + 1.92, zz, { r: 0.075, h: 0.09, color: rr.pick(['#3a3346', '#c7805d', '#4f5a66']), plant: 'flowers', n: 7, flowers: pal[i % pal.length] });
      else P.pot(S, x, FY + 1.92, zz, { r: 0.08, h: 0.1, color: '#e8e2d6', plant: 'bush', greens: [rr.pick(['#6f9a5a', '#5f8c5c', '#86ad68'])] });
    }
    // one big leafy plant at the back corner
    P.pot(S, -2.55, FY, -9.9, { r: 0.2, h: 0.34, color: '#8a8e94', plant: 'tall', th: 0.8, greens: ['#5f8c5c', '#6f9a5a'] });
    S.cyl(-2.55, -9.9, 0.24, -1, 1.6);
  }
}
