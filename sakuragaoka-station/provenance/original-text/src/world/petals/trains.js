// Train state for the petal gust field. Reads ctx.services.rail.trains every frame; if the trains
// module is absent, falls back to a kinematic estimate of L.SCHEDULE (so the swirls still happen).
// Returns up to 4 entries: { x (centre), z (track), v (signed m/s along X), half (half length),
// doors (0..1), side (+1 = doors/platform on +Z side, -1 = on -Z side) }.

export function createTrainReader(ctx) {
  const L = ctx.L;
  const zOf = (track) => (track === 'B' ? L.RAIL.zB : L.RAIL.zA);
  const sideOf = (track) => (track === 'B' ? -1 : 1); // A stops at the south platform (+Z), B at the north (-Z)
  const halfLen = L.TRAIN.cars * L.TRAIN.carLen / 2;
  const stopX = L.TRAIN.stopCenterX;
  const P = L.TRAIN.period;
  const doorsIn = (t, a, b) => Math.min(1, Math.max(0, t - a)) * Math.min(1, Math.max(0, b - t));

  function fallback(tAbs) {
    const t = ((tAbs % P) + P) % P;
    const out = [];
    // --- train A: westbound on track A (moves -X)
    {
      const S = L.SCHEDULE.A;
      let x = null, v = 0, doors = 0;
      const a = 0.9, vmax = 16;
      if (t >= S.stopped[0] && t < S.stopped[1]) { x = stopX; v = 0; doors = doorsIn(t, S.doors[0], S.doors[1]); }
      else if (t >= S.depart && t < S.arriveFromEast[0]) {
        const dt = t - S.depart, tA = vmax / a;
        if (dt < tA) { x = stopX - 0.5 * a * dt * dt; v = -a * dt; }
        else { x = stopX - 0.5 * a * tA * tA - vmax * (dt - tA); v = -vmax; }
      } else if (t >= S.arriveFromEast[0]) {
        const dt = S.arriveFromEast[1] - t, ad = vmax / (S.arriveFromEast[1] - S.arriveFromEast[0]);
        x = stopX + 0.5 * ad * dt * dt; v = -ad * dt;
      }
      if (x !== null && x > -460 && x < 460) out.push({ x, z: zOf('A'), v, half: halfLen, doors, side: sideOf('A') });
    }
    // --- train B: eastbound on track B (moves +X)
    {
      const S = L.SCHEDULE.B;
      let x = null, v = 0, doors = 0;
      const tStop = S.stop, a = 0.716, ad = 0.9, vmax = 20;
      if (t < tStop) {
        const dt = tStop - t; // decelerating arrival from the west
        const tA = vmax / a;
        if (dt < tA) { x = stopX - 0.5 * a * dt * dt; v = a * dt; }
        else { x = stopX - 0.5 * a * tA * tA - vmax * (dt - tA); v = vmax; }
      } else if (t < S.depart) { x = stopX; v = 0; doors = doorsIn(t, S.doors[0], S.doors[1]); }
      else {
        const dt = t - S.depart, tA = vmax / ad;
        if (dt < tA) { x = stopX + 0.5 * ad * dt * dt; v = ad * dt; }
        else { x = stopX + 0.5 * ad * tA * tA + vmax * (dt - tA); v = vmax; }
      }
      if (x !== null && x > -460 && x < 460) out.push({ x, z: zOf('B'), v, half: halfLen, doors, side: sideOf('B') });
    }
    return out;
  }

  function read(t) {
    const list = ctx.services.rail?.trains;
    if (Array.isArray(list) && list.length) {
      const out = [];
      for (const tr of list) {
        if (!tr || !Number.isFinite(tr.x) || tr.visible === false) continue;
        const cx = Number.isFinite(tr.front) && Number.isFinite(tr.tail) && Math.abs(tr.front - tr.tail) > 1 ? (tr.front + tr.tail) / 2 : tr.x;
        if (Math.abs(cx) > 600) continue;
        const dir = tr.dir === -1 || tr.dir < 0 ? -1 : 1;
        const sp = Number.isFinite(tr.speed) ? Math.abs(tr.speed) : 0;
        out.push({
          x: cx, z: Number.isFinite(tr.z) ? tr.z : zOf(tr.track), v: dir * sp,
          half: (Number.isFinite(tr.length) ? tr.length : halfLen * 2) / 2,
          doors: Math.max(0, Math.min(1, tr.doorsOpen || 0)), side: sideOf(tr.track),
        });
        if (out.length >= 4) break;
      }
      return out;
    }
    return fallback(t);
  }
  return { read, fallback };
}
