// 桜川線 — the railway corridor module.
// Track (ballast bed, rails, PC / wooden sleepers, fasteners, joints, crossover with two turnouts),
// catenary (centre poles near the station, portal beams elsewhere, zig-zag contact wire, droppers,
// feeders), signals animated from ctx.services.rail, km posts, speed signs, equipment, troughs,
// walkway, drainage, fences (with colliders), warning / emergency signs and swaying corridor weeds.
import * as THREE from 'three';
import { makeRailTextures } from './railway/tex.js';
import { buildTrack } from './railway/track.js';
import { buildCatenary, CONTACT_Y, MESSENGER_Y } from './railway/catenary.js';
import { buildTrackside } from './railway/trackside.js';
import { buildWeeds } from './railway/weeds.js';
import { premerge } from './railway/merge.js';

function makeEnv(L) {
  const R = L.RAIL;
  const HG = R.gauge / 2 + 0.0325; // rail centreline offset from the track centre
  return {
    L, R, HG, zA: R.zA, zB: R.zB, X0: R.xMin, X1: R.xMax,
    rails: { SaZ: R.zA + HG, NaZ: R.zA - HG, SbZ: R.zB + HG, NbZ: R.zB - HG },
    xo: { xa: 66, xb: 114 },                                   // crossover (A -> B) between x 66..114
    cross: [L.CROSSING.zone.x0, L.CROSSING.zone.x1],           // -17..-7 (crossing module)
    walk: [L.PLATFORM.walkCrossing.x0, L.PLATFORM.walkCrossing.x1], // 46..48.5 (構内踏切, station)
    station: [L.PLATFORM.south.x0, 50],
  };
}

export async function build(ctx) {
  const { L } = ctx;
  const root = new THREE.Group(); root.name = 'railway';
  ctx.addStatic(root);
  const E = makeEnv(L);
  const T = makeRailTextures(ctx);
  const track = buildTrack(ctx, root, T, E);
  const cat = buildCatenary(ctx, root, T, E);
  const side = buildTrackside(ctx, root, T, E, track, cat);
  const weeds = buildWeeds(ctx, root, T, E, track, cat, side);
  const merged = premerge(root); // corridor-long meshes per material (few draw calls)

  // ------------------------------------------------ signal logic (pure function of t + optional services.rail)
  const P = L.TRAIN.period || 120;
  const WINDOWS = { // fallback schedule windows (t mod 120) derived from L.SCHEDULE
    'A-start': [[L.SCHEDULE.A.doors[1] + 0.5, L.SCHEDULE.A.depart + 12]],
    'A-home': [[L.SCHEDULE.A.arriveFromEast[0] - 8, L.SCHEDULE.A.arriveFromEast[0] + 12]],
    'B-start': [[L.SCHEDULE.B.doors[1] + 0.5, L.SCHEDULE.B.depart + 10]],
    'B-home': [[P - 4, P], [0, L.SCHEDULE.B.passCrossing[0] - 4]],
  };
  const inWin = (id, ph) => WINDOWS[id].some(([a, b]) => ph >= a && ph <= b);
  const passed = (tr, sx) => {
    const half = (tr.length || 36) / 2, dir = tr.dir || (tr.track === 'A' ? -1 : 1);
    return dir < 0 ? tr.x + half < sx - 1 : tr.x - half > sx + 1;
  };
  const signalGreen = (s, t) => {
    const ph = ((t % P) + P) % P;
    if (!inWin(s.id, ph)) return false;
    const trains = ctx.services.rail?.trains;
    if (Array.isArray(trains)) {
      const tr = trains.find(q => q && q.track === s.track);
      if (tr && Number.isFinite(tr.x)) {
        if (passed(tr, s.x)) return false;
        if (s.kind === 'start' && (tr.doorsOpen || 0) > 0.05) return false;
      }
    }
    return true;
  };
  ctx.onUpdate((dt, t) => {
    for (const s of side.signals) {
      const g = signalGreen(s, t);
      if (g !== s.state) { s.state = g; s.litG.visible = g; s.litR.visible = !g; }
    }
  });
  // initial state
  for (const s of side.signals) { const g = signalGreen(s, 0); s.state = g; s.litG.visible = g; s.litR.visible = !g; }

  ctx.services.railway = {
    catenaryPoles: cat.poles.map(p => ({ x: p.x, type: p.type === 'C' ? 'centre' : 'portal', z: p.type === 'C' ? [-43] : [cat.zSouthPole, cat.zNorthPole] })),
    contactWireY: CONTACT_Y, messengerY: MESSENGER_Y,
    signals: side.signals.map(s => ({ id: s.id, x: s.x, z: s.z, track: s.track, green: () => s.state })),
    crossover: { x0: E.xo.xa, x1: E.xo.xb },
    fences: { southZ: side.S.fence, northZ: side.zs(side.S.fence, -1), ranges: side.STRIP_X },
    ballastY: E.ballastY,
    stats: { stones: track.stoneCount, weeds: weeds.count, merged, atlasFill: T.atlasFill?.(), atlasFallbacks: T.atlasFallbacks || 0 },
  };
}
