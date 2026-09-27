// Display-only reconstruction of aiInput's local target, after it chooses r.lane
// and before any racer moves. This never supplies inputs or changes racer state.
export function targetFor(r, racers, { trackAt, pinchAt, TRACK_HALF, hAt }) {
  const look = 25 + Math.max(0, r.vf) * 0.42;
  const distance = r.Q.s + look;
  const point = trackAt(distance), bounds = pinchAt(distance);
  const s = Math.sin(r.th), c = Math.cos(r.th);
  let avoid = 0;
  for (const other of racers) {
    if (other === r) continue;
    const dx = other.x - r.x, dz = other.z - r.z;
    const ahead = dx * s + dz * c, side = dx * c - dz * s;
    if (ahead > 0 && ahead < 48 && Math.abs(side) < 10) {
      avoid += (side > 0 ? -1 : 1) * (1 - ahead / 48) * 16;
    }
  }
  const lane = Math.max(Math.max(-(TRACK_HALF - 4), bounds.lo + 7),
    Math.min(Math.min(TRACK_HALF - 4, bounds.hi - 7), r.lane + avoid));
  return { x: point.x + point.tz * lane, y: hAt(distance) + 5,
    z: point.z - point.tx * lane, look, lane, avoid };
}
