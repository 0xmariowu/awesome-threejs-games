// Where petals LIE: the ground layout plan. Never uniform — clumpy clusters under every tree pushed
// downwind, wind-blown streaks, drifts hugging curbs / walls / gutters, small piles in road and
// platform corners, fence bases, ballast near the station, benches, vending machine tops, café
// tables + a few stuck to the café window, wall tops under trees, and a thin scatter elsewhere.
// All heights come from E.surf / E.surfP / E.SI (the exact rendered surfaces), so nothing floats
// or sinks; furniture is only decorated when the surface index proves it exists.

export function planGround(ctx, G, E) {
  const L = ctx.L, H = L.heightAt;
  const { r, Q, trees, SI, dens, noise, patch } = E;
  const gauss = E.gauss;
  const clumpCell = () => (r() < 0.5 ? 0 : 1), streakCell = () => (r() < 0.5 ? 2 : 3);
  const WA = Math.atan2(0.35, 0.9), wdx = Math.cos(WA), wdz = Math.sin(WA);
  const clumpy = (x, z, k = 1) => { const n = noise(x * 0.55 * k, z * 0.55 * k) * 0.65 + noise(x * 1.9 * k + 17, z * 1.9 * k - 9) * 0.35; return n; };
  const acceptClump = (x, z, lo = 0.3, hi = 0.72) => { const n = clumpy(x, z); const t = Math.min(1, Math.max(0, (n - lo) / (hi - lo))); return r() < t * t * (3 - 2 * t) * 1.15; };
  const corner = (x, z, ang, n, pile = 0.02) => {
    G.cluster(x, z, 0.26 + r() * 0.2, 0.12 + r() * 0.08, ang, Math.round(n * Q), { pile, mode: 'edge' });
    G.cluster(x + Math.cos(ang) * 0.35, z + Math.sin(ang) * 0.35, 0.6, 0.35, ang, Math.round(n * 0.5 * Q), { mode: 'edge' });
  };

  // ------------------------------------------------------------------ 1. under every sakura
  const core = { x: 6, z: -8 };
  let wsum = 0;
  const tw = trees.map(t => {
    const d = Math.hypot(t.x - core.x, t.z - core.z);
    const p = Math.max(0.12, Math.min(1, 1 - (d - 45) / 100));
    const w = (t.boost || 1) * Math.pow(t.r, 2.4) * p * p;
    wsum += w; return w;
  });
  const treeBudget = 26000 * Q;
  trees.forEach((t, i) => {
    const n = Math.min(6000, Math.round(treeBudget * tw[i] / Math.max(1, wsum)));
    if (n < 8) return;
    const tx = t.tx, tz = t.tz;
    // canopy footprint centre, pushed downwind (petals fly ~0.3–0.6 r before landing)
    const cx = (t.x + tx) / 2 + wdx * t.r * 0.35, cz = (t.z + tz) / 2 + wdz * t.r * 0.35;
    const reject = (x, z) => !acceptClump(x, z, 0.26, 0.7);
    // a) main patchy carpet under the crown
    G.cluster(cx, cz, t.r * 0.52, t.r * 0.42, WA, Math.round(n * 0.34), { reject });
    G.cluster(cx, cz, t.r * 0.8, t.r * 0.66, WA, Math.round(n * 0.2), { reject });
    // b) root ring: petals caught around the trunk base / tree pit
    const tr = (t.trunkR || 0.3) + 0.04;
    for (let k = 0; k < n * 0.1; k++) {
      const a = r() * Math.PI * 2, d = tr + Math.pow(r(), 2.2) * 0.55;
      G.onGround(tx + Math.cos(a) * d, tz + Math.sin(a) * d, {});
    }
    // c) downwind streaks trailing out from under the crown
    const ns = 2 + Math.floor(r() * 3);
    for (let s = 0; s < ns; s++) {
      const ang = WA + (r() - 0.5) * 0.7, len = t.r * (0.8 + r() * 1.1) + 2;
      const ox = cx + (r() - 0.5) * t.r * 0.8, oz = cz + (r() - 0.5) * t.r * 0.8;
      G.streak(ox + Math.cos(ang) * len * 0.5, oz + Math.sin(ang) * len * 0.5, ang, len, 0.35 + r() * 0.6, Math.round(n * 0.3 / ns), {});
    }
    // d) sparse halo
    G.cluster(cx + wdx * t.r * 0.4, cz + wdz * t.r * 0.4, t.r * 1.5, t.r * 1.2, WA, Math.round(n * 0.1), {});
    // e) carpet patches (many petals per quad) where the drift is thickest
    const np = Math.round(n / 30);
    for (let k = 0, tries = 0; k < np && tries < np * 5; tries++) {
      const u = gauss() * t.r * 0.55, v = gauss() * t.r * 0.45;
      const x = cx + u * wdx - v * wdz, z = cz + u * wdz + v * wdx;
      if (!acceptClump(x, z, 0.3, 0.66)) continue;
      const streaky = r() < 0.35;
      const l = streaky ? 1.2 + r() * 1.4 : 0.7 + r() * 0.9, w = streaky ? 0.4 + r() * 0.35 : l * (0.7 + r() * 0.3);
      if (patch(x, z, l, w, streaky ? WA + (r() - 0.5) * 0.5 : r() * Math.PI * 2, streaky ? streakCell() : clumpCell())) k++;
    }
  });

  // ------------------------------------------------------------------ 2. edges: curbs, walls, gutters, road edges
  const edges = E.edges;
  for (const e of edges) {
    const [ax, az] = e.a, [bx, bz] = e.b;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.3) continue;
    const d = dens(mx, mz);
    const k = (0.25 + d * 1.1) * Q;
    const tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx;
    if (e.kind === 'curb') {
      const yP = E.surfRaw(mx + nx * 0.22, mz + nz * 0.22), yN = E.surfRaw(mx - nx * 0.22, mz - nz * 0.22);
      const low = !Number.isFinite(yP) ? -1 : !Number.isFinite(yN) ? 1 : (yP < yN ? 1 : -1);
      G.strip(ax, az, bx, bz, 6.5 * k, { sides: [low], band: [0.015, 0.34], hug: 2.6, piles: 4.5, mode: 'edge' });
      G.strip(ax, az, bx, bz, 1.2 * k, { sides: [-low], band: [0.04, 0.55], hug: 1.6, mode: 'edge' });
    } else if (e.kind === 'wall') {
      G.strip(ax, az, bx, bz, 4.0 * k, { band: [0.03, 0.3], hug: 2.4, piles: 6, mode: 'edge' });
    } else if (e.kind === 'gutter') {
      G.strip(ax, az, bx, bz, 2.6 * k, { band: [0.0, 0.28], hug: 1.4, piles: 7, mode: 'edge' });
    } else {
      G.strip(ax, az, bx, bz, 1.8 * k, { band: [0.05, 0.6], hug: 1.8, mode: 'edge' });
    }
  }
  // petals caught on / around gutter grates (§二)
  for (const g of E.grates) {
    const n = Math.round((10 + r() * 16) * Q * (0.4 + dens(g.x, g.z)));
    G.cluster(g.x, g.z, 0.3, 0.12, g.ang, n, { pile: 0.006, mode: 'edge' });
  }

  // ------------------------------------------------------------------ 3. road corners (drifts pile up where the wind eddies)
  const C = [
    [-3.35, 1.25, 2.4], [3.35, 1.25, 0.7], [-3.1, 3.2, -2.2], [3.1, 3.2, -0.9],
    [-14.95, -5.15, 2.6], [-9.05, -5.15, 0.5], [-14.95, 1.1, -2.6], [-9.05, 1.1, -0.5],
    [-14.95, -53.4, 2.6], [-9.05, -53.4, 0.5], [-14.95, -57.6, -2.6], [-9.05, -57.6, -0.5],
    [-14.95, -69.4, 2.6], [-9.05, -69.4, 0.5], [-14.95, -72.6, -2.6], [-9.05, -72.6, -0.5],
    [L.PLAZA.x0 + 0.3, L.PLAZA.z1 - 0.3, -0.8], [L.PLAZA.x1 - 0.3, L.PLAZA.z1 - 0.3, -2.3], [L.PLAZA.x1 - 0.4, L.PLAZA.z0 + 0.5, 2.3],
    [-8.9, -33.8, 0.6], [-15.2, -33.8, 2.5],
  ];
  for (const [x, z, a] of C) { corner(x, z, a, 70 + r() * 70, 0.018 + r() * 0.012); patch(x + Math.cos(a) * 0.45, z + Math.sin(a) * 0.45, 0.9 + r() * 0.5, 0.6 + r() * 0.3, a, clumpCell()); }

  // ------------------------------------------------------------------ 4. wind streaks on open pavement + along the roads
  const streaksIn = (x0, z0, x1, z1, n, per, lmin = 1.4, lmax = 4.2) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (r() > 0.25 + dens(x, z)) continue;
      const ang = WA + (r() - 0.5) * 0.5, len = lmin + r() * (lmax - lmin);
      G.streak(x, z, ang, len, 0.25 + r() * 0.5, Math.round(per * (0.6 + r() * 0.8) * Q), {});
      if (r() < 0.7) patch(x + Math.cos(ang) * len * 0.2, z + Math.sin(ang) * len * 0.2, Math.min(2.6, len * 0.7), 0.35 + r() * 0.35, ang, streakCell());
    }
  };
  streaksIn(L.PLAZA.x0, L.PLAZA.z0, L.PLAZA.x1, L.PLAZA.z1, 34, 60);
  streaksIn(-60, -5, 60, 1, 30, 40);                       // R3
  streaksIn(-14.7, -33, -9.3, -6, 8, 45);                  // R2 south of the crossing
  streaksIn(-60, -57.5, 60, -53.5, 22, 35);                // R4 under the sakura tunnel
  // main street: petals combed into lines along the wheel tracks and the edges
  for (let z = 2; z < 128; z += 2.4 + r() * 3) {
    const cx = L.streetCenterX(z), sx = L.streetSlopeX(z);
    const d = dens(cx, z);
    if (r() > 0.35 + d) continue;
    const off = r.pick([-2.45, -1.35, -0.05, 1.35, 2.45]) + (r() - 0.5) * 0.3;
    const ang = Math.atan2(-1, -sx) + (r() - 0.5) * 0.25;
    G.streak(cx + off, z, ang, 1.5 + r() * 4, 0.18 + r() * 0.25, Math.round((30 + r() * 40) * Q), {});
    if (r() < 0.75) patch(cx + off, z + (r() - 0.5), 1.3 + r() * 1.3, 0.28 + r() * 0.22, ang + (r() - 0.5) * 0.15, streakCell());
    if (r() < 0.3) G.streak(cx + (r() - 0.5) * 4, z + (r() - 0.5) * 2, WA + (r() - 0.5) * 0.4, 1.2 + r() * 2, 0.3 + r() * 0.4, Math.round(30 * Q), {});
  }

  // ------------------------------------------------------------------ 5. platforms: fence bases, corners, edges, streaks
  const PL = L.PLATFORM;
  const onP = (x, z, o = {}) => { const y = E.surfP(x, z); if (y === null) return false; return G.put(x, y, z, o); };
  const plats = [
    { p: PL.south, back: PL.south.z1, inward: -1, edge: PL.south.z0 },
    { p: PL.north, back: PL.north.z0, inward: 1, edge: PL.north.z1 },
  ];
  for (const P of plats) {
    const { p } = P;
    // fence / wall base drift along the back edge
    for (let i = 0; i < 2400 * Q; i++) {
      const x = p.x0 + 0.1 + r() * (p.x1 - p.x0 - 0.2);
      if (!acceptClump(x * 1.7, P.back, 0.3, 0.75)) continue;
      const off = 0.03 + Math.pow(r(), 2.4) * 0.45;
      onP(x, P.back + P.inward * off);
    }
    // tactile strip / track edge: a looser line of petals the trains keep brushing
    for (let i = 0; i < 700 * Q; i++) {
      const x = p.x0 + 0.2 + r() * (p.x1 - p.x0 - 0.4);
      if (!acceptClump(x, P.edge * 1.3)) continue;
      onP(x, P.edge - P.inward * (0.35 + r() * 0.9));
    }
    // corners
    for (const [x, z] of [[p.x0 + 0.25, P.back + P.inward * 0.25], [p.x1 - 0.3, P.back + P.inward * 0.25], [p.x0 + 0.3, P.edge - P.inward * 0.5]]) {
      for (let i = 0; i < 90 * Q; i++) { const u = E.gauss() * 0.28, v = E.gauss() * 0.16; onP(x + u, z + v, { stack: Math.max(0, 0.012 * (1 - (u * u + v * v) / 0.15)) * r(), tilt: 0.5 }); }
    }
    // streaks and scatter across the deck
    for (let i = 0; i < 16; i++) {
      const x = p.x0 + 1 + r() * (p.x1 - p.x0 - 2), z = p.z0 + 0.5 + r() * (p.z1 - p.z0 - 1);
      const ang = WA + (r() - 0.5) * 0.6, len = 1.2 + r() * 3, cnt = Math.round((25 + r() * 35) * Q);
      const c = Math.cos(ang), s = Math.sin(ang);
      for (let k = 0; k < cnt; k++) { const u = (Math.pow(r(), 0.7) - 0.5) * len, v = E.gauss() * 0.14; onP(x + u * c - v * s, z + u * s + v * c); }
    }
    for (let i = 0; i < 500 * Q; i++) onP(p.x0 + r() * (p.x1 - p.x0), p.z0 + r() * (p.z1 - p.z0));
    const rawP = (x, z) => SI.empty ? L.PLATFORM.y : SI.top(x, z, L.PLATFORM.y - 0.25, L.PLATFORM.y + 0.25);
    for (let i = 0; i < 44; i++) {
      const x = p.x0 + 1 + r() * (p.x1 - p.x0 - 2), z = r() < 0.5 ? P.back + P.inward * (0.3 + r() * 0.3) : p.z0 + 0.6 + r() * (p.z1 - p.z0 - 1.2);
      const along = Math.abs(z - P.back) < 0.7;
      patch(x, z, 1.0 + r() * 1.4, along ? 0.3 + r() * 0.15 : 0.35 + r() * 0.3, along ? (r() - 0.5) * 0.12 : WA + (r() - 0.5) * 0.6, streakCell(), { surf: E.surfP, raw: rawP });
    }
  }

  // ------------------------------------------------------------------ 6. between the ballast near the station
  const onBallast = (x, z) => {
    const y = E.surfRaw(x, z);
    if (!Number.isFinite(y)) return;
    // never on the rail heads
    for (const zc of [L.RAIL.zA, L.RAIL.zB]) for (const s of [-1, 1]) if (Math.abs(z - (zc + s * L.RAIL.gauge / 2)) < 0.06 && y > 0.08) return;
    G.put(x, y, z, { tilt: 0.55, lift: 0.012 });
  };
  for (let i = 0; i < 3200 * Q; i++) {
    const x = -45 + Math.pow(r(), 1.2) * 120, zc = r() < 0.5 ? L.RAIL.zA : L.RAIL.zB;
    const z = zc + E.gauss() * 1.5;
    if (z > PL.south.z0 && x > PL.south.x0 && x < PL.south.x1 + 6) continue;   // under the platform overhang
    if (z < PL.north.z1 && x > PL.north.x0 && x < PL.north.x1 + 6) continue;
    if (!acceptClump(x * 1.3, z * 1.3, 0.28, 0.7) && r() < 0.6) continue;
    onBallast(x, z);
  }
  // corridor margins further out (sparser)
  for (let i = 0; i < 1400 * Q; i++) {
    const x = -90 + r() * 180, z = -51.5 + r() * 17;
    if (x > -8 && x < 47 && z > -51 && z < -35) continue;
    if (r() > 0.2 + dens(x, z)) continue;
    onBallast(x, z);
  }

  // ------------------------------------------------------------------ 7. furniture: benches, vending tops, café tables & window, wall tops
  const onSurface = (cx, cz, rotY, w, d, yRef, tol, count, o = {}) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const bx = (r() - 0.5) * 0.7, bz = (r() - 0.5) * 0.6;
    let placed = 0;
    for (let i = 0; i < count * 1.6 && placed < count; i++) {
      let lx = (r() - 0.5) * w, lz = (r() - 0.5) * d;
      if (r() < 0.5) { lx = (bx + E.gauss() * 0.22) * w * 0.5; lz = (bz + E.gauss() * 0.3) * d * 0.5; }
      if (Math.abs(lx) > w / 2 || Math.abs(lz) > d / 2) continue;
      const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
      let y = yRef;
      if (!SI.empty) { y = SI.top(x, z, yRef - tol, yRef + tol); if (!Number.isFinite(y)) continue; }
      if (G.put(x, y, z, { lift: 0.006, tilt: o.tilt ?? 0.16, size: o.size ?? 0.031, tone: o.tone ? o.tone() : undefined })) placed++;
    }
    return placed;
  };
  const exists = (x, z, y, tol) => SI.empty ? false : Number.isFinite(SI.top(x, z, y - tol, y + tol));
  const benches = [];
  for (const b of (ctx.services.station?.benches || [])) benches.push({ ...b, n: 14 + r() * 16 });
  for (const b of (ctx.services.plaza?.benches || [])) benches.push({ ...b, n: 12 + r() * 20 });
  { const v = L.SPOTS.v5Bench; benches.push({ x: v.x, z: v.z, y: H(v.x, v.z) + v.seatY, rotY: v.rotY, len: v.len, n: 150, heavy: true }); } // 落满花瓣的长椅
  if (!ctx.services.station) { const b = PL.benchB1; benches.push({ x: b.x, z: b.z, y: PL.y + 0.44, rotY: b.rotY, len: 1.6, n: 18 }); }
  let benchCount = 0;
  for (const b of benches) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
    // find the real seat top near the declared height (tolerant: 0.44 vs 0.45 conventions; the probe
    // grid covers the footprint so a gap between slats cannot hide the bench)
    let y = -Infinity;
    if (!SI.empty) {
      const c = Math.cos(b.rotY || 0), sn = Math.sin(b.rotY || 0), hl = Math.max(0.3, (b.len || 1.4) / 2 - 0.05);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const lx = i / 2 * hl, lz = j / 2 * 0.17;
        const t = SI.top(b.x + lx * c + lz * sn, b.z - lx * sn + lz * c, b.y - 0.12, b.y + 0.12);
        if (Number.isFinite(t) && t > y) y = t;
      }
    }
    if (!Number.isFinite(y)) continue;
    const n = Math.round(b.n * Q);
    benchCount += onSurface(b.x, b.z, b.rotY || 0, Math.max(0.5, (b.len || 1.4) - 0.06), 0.4, y, 0.05, n, { tilt: 0.2 });
    if (b.heavy) { // 落満花瓣的长椅: petals also drift under / around it
      const c = Math.cos(b.rotY), s = Math.sin(b.rotY);
      for (let k = 0; k < 70 * Q; k++) { const lx = (r() - 0.5) * (b.len + 0.8), lz = 0.35 + Math.pow(r(), 1.5) * 0.9; G.onGround(b.x + lx * c + lz * s, b.z - lx * s + lz * c, {}); }
    }
  }
  let vendCount = 0;
  for (const v of L.VENDING) {
    const base = Number.isFinite(v.y) ? v.y : H(v.x, v.z);
    if (SI.empty) continue;
    const t = SI.top(v.x, v.z, base + 1.6, base + 2.2);
    if (!Number.isFinite(t)) continue;
    // settle toward the back edge (the wind rolls them off the front)
    vendCount += onSurface(v.x, v.z, v.rotY, 0.86, 0.62, t, 0.06, Math.round((16 + r() * 14) * Q), { tilt: 0.12, size: 0.034, tone: () => 0.45 + r() * 0.7 });
  }
  let cafeCount = 0;
  const sA = ctx.services.shopsA;
  if (sA && Array.isArray(sA.cafeTables)) {
    for (const tb of sA.cafeTables) {
      if (!Number.isFinite(tb.x) || !Number.isFinite(tb.y)) continue;
      if (!exists(tb.x, tb.z, tb.y, 0.08)) continue;
      const tt = SI.top(tb.x, tb.z, tb.y - 0.08, tb.y + 0.08);
      const n = Math.round((11 + r() * 8) * Q);
      for (let i = 0, placed = 0; i < n * 3 && placed < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.34;
        const x = tb.x + Math.cos(a) * d, z = tb.z + Math.sin(a) * d;
        const y = SI.top(x, z, tt - 0.03, tt + 0.03);
        if (!Number.isFinite(y)) continue;
        if (G.put(x, y, z, { lift: 0.005, tilt: 0.14, size: 0.031, tone: 0.55 + r() * 0.65 })) { placed++; cafeCount++; }
      }
    }
  }
  if (sA && sA.cafeWindow && Number.isFinite(sA.cafeWindow.x)) { const w = sA.cafeWindow; G.onPane({ ...w, w: w.w || 2, h: w.h || 1.5 }, Math.round(34 * Q)); cafeCount += 34; }
  if (sA) { // a few blown onto the café terrace / doorstep (under the awning edge)
    const lot = L.lotById('E1');
    for (let i = 0; i < 260 * Q; i++) {
      const p = L.lotToWorld(lot, (r() - 0.5) * 11, -Math.pow(r(), 1.3) * 3.2);
      G.onGround(p.x, p.z, { mode: 'edge' });
    }
  }
  for (const wt of (ctx.services.houses?.wallTops || [])) {
    if (!Number.isFinite(wt.x) || !Number.isFinite(wt.y)) continue;
    let near = 0; for (const t of trees) { const d = Math.hypot(t.x - wt.x, t.z - wt.z); if (d < t.r + 4) near = Math.max(near, 1 - d / (t.r + 4)); }
    if (near <= 0) continue;
    const top = SI.empty ? NaN : SI.top(wt.x, wt.z, wt.y - 0.12, wt.y + 0.12);
    if (!Number.isFinite(top)) continue;
    onSurface(wt.x, wt.z, wt.rotY || 0, Math.max(0.3, (wt.len || 2) - 0.1), 0.1, top, 0.04, Math.round(near * (wt.len || 2) * 5 * Q), { tilt: 0.15 });
  }

  // ------------------------------------------------------------------ 8. thin scatter across the walkable town
  const S = L.WORLD.play;
  for (let i = 0; i < 9000 * Q; i++) {
    const x = S.x0 + r() * (S.x1 - S.x0), z = S.z0 + r() * (S.z1 - S.z0);
    const d = dens(x, z);
    if (r() > d * d * 0.9 + 0.03) continue;
    G.onGround(x, z, {});
  }
  // levee path + slopes: a pink carpet under the 桜堤
  for (let i = 0; i < 2600 * Q; i++) {
    const x = -95 + r() * 190, z = -96.5 + r() * 9;
    if (!acceptClump(x, z, 0.32, 0.7)) continue;
    G.onGround(x, z, {});
  }
  for (let i = 0, k = 0; i < 400 && k < 110 * Q; i++) {
    const x = -95 + r() * 190, z = -95.6 + r() * 5.2;
    if (!acceptClump(x, z, 0.35, 0.68)) continue;
    const streaky = r() < 0.5;
    if (patch(x, z, streaky ? 1.4 + r() * 1.2 : 0.8 + r() * 0.8, streaky ? 0.4 + r() * 0.3 : 0.6 + r() * 0.5, streaky ? WA + (r() - 0.5) * 0.4 : r() * 6.28, streaky ? streakCell() : clumpCell())) k++;
  }
  return { benchCount, vendCount, cafeCount };
}
