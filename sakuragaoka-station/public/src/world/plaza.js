// 駅前広場 — station-front plaza (plaza module).
// Paving + curbs + tactile paths, tree pit & ring bench around the big sakura (tree itself = sakura module),
// boards, bus stop + shelter, taxi stand, postbox, phone booth, bicycle racks (bikes = vehicles module),
// flower beds, hedge, bollards, chains, bins, lamps, clock, monument.  Publishes ctx.services.plaza.
import * as THREE from 'three';
import { makeTextures } from './plaza/textures.js';
import { makeSigns } from './plaza/signs.js';
import { buildGround } from './plaza/ground.js';
import { buildTree } from './plaza/tree.js';
import { buildFurniture } from './plaza/furniture.js';
import { buildPlants } from './plaza/plants.js';

export async function build(ctx) {
  const { L } = ctx;
  const PL = L.PLAZA;

  // ---------------------------------------------------------------- layout (world coords, y = 0 plaza)
  // West part (x < -3) stays low: the hero view looks through it to the level crossing.
  const P = {
    x0: PL.x0, x1: PL.x1, z0: PL.z0, z1: PL.z1,
    yPave: 0.02, curbW: 0.2,
    tree: { x: PL.tree.x, z: PL.tree.z }, circleR: 3.55,
    bikeArea: { x0: 15.9, x1: 25.35, z0: -16.4, z1: -8.3 },
    curbCutsR3: [[-2.0, 2.0], [17.0, 18.6]],     // crosswalk (x≈0) + bicycle entrance
    curbCutsR2: [[-21.8, -19.8]],                // pedestrian access from the crossing road
    // tactile blocks [x0,z0,x1,z1,kind]  dots = warning (点状), v/u = guide bars along z / x (線状)
    tactile: [
      [-0.9, -5.8, 0.9, -5.2, 'dots'],
      [-0.15, -7.6, 0.15, -5.8, 'v'],
      [-0.15, -7.9, 0.15, -7.6, 'dots'],
      [0.15, -7.9, 3.75, -7.6, 'u'],
      [3.75, -7.9, 4.05, -7.6, 'dots'],
      [4.05, -7.9, 7.35, -7.6, 'u'],
      [7.35, -8.05, 7.95, -7.45, 'dots'],
      [3.75, -19.9, 4.05, -7.9, 'v'],
      [3.3, -20.5, 4.5, -19.9, 'dots'],
    ],
    mapBoard: { x: 1.6, z: -19.2, rotY: 0 },
    tourBoard: { x: 11.2, z: -18.9, rotY: -0.35 },
    noticeBoard: { x: 24.95, z: -19.6, rotY: -Math.PI / 2 },           // backed by the east hedge, faces the plaza (sakura's forecourtE tree stands at 19.5,-22)
    shelter: { x: 10.5, z: -7.2, w: 3.2 },
    postbox: { x: -2.9, z: -6.35, rotY: 0 },
    phone: { x: 14.3, z: -17.6, rotY: -Math.PI / 2 },
    bikeSign: { x: 15.6, z: -8.05, rotY: -0.64 },
    clock: { x: 6.4, z: -14.6, rotY: 0 },
    monument: { x: -6.7, z: -21.4, rotY: 0.3 },
    fountain: { x: -0.6, z: -19.1, rotY: 0.2 },
    taxiMark: { x: -7.25, z: -6.0 },
    planters: [[15.25, -9.2], [15.25, -15.4]],
    parkBench: { x: 15.2, z: -12.3, rotY: -Math.PI / 2, len: 1.7 },   // between the round planters, facing the tree
    nameSign: { x: 4.8, z: -6.8, rotY: 0 },                          // low station-name board in the crosswalk tulip bed
    inlay: { x: 6.4, z: -14.6, d: 3.4 },
    bollards: [[-2.35, -5.62], [-1.2, -5.65], [1.2, -5.65], [2.35, -5.62], [-8.6, -5.75], [16.8, -5.62], [18.8, -5.62], [-8.6, -21.95], [-8.6, -19.65]],
    chains: [[2.9, 7.2, -5.62], [12.45, 16.5, -5.62], [19.1, 25.2, -5.62]],
    bins: [{ x: 12.95, z: -8.2, rotY: -Math.PI / 2 }, { x: -4.9, z: -19.3, rotY: 0.35 }],
    lamps: [[5.8, -9.2], [12.6, -12.8], [15.4, -6.5], [17.2, -21.0]],
    beds: [
      { x0: -8.6, z0: -24.8, x1: -4.8, z1: -22.5, edge: 'brick', kind: 'tulips', h: 0.32, shrubEnds: true },
      { x0: 2.6, z0: -7.0, x1: 7.0, z1: -5.95, edge: 'concrete', kind: 'tulips', h: 0.34 },
      { x0: -8.7, z0: -19.2, x1: -7.5, z1: -8.85, edge: 'concrete', kind: 'border', h: 0.3 },   // ends short of sakura's plazaSW pit
      { x0: 21.0, z0: -24.85, x1: 25.3, z1: -23.45, edge: 'brick', kind: 'tulips', h: 0.32 },
    ],
    hedge: { x0: 25.45, x1: 26.0, z0: -24.8, z1: -5.75 },
    grates: [[-4.9, -5.72], [14.45, -5.75], [22.9, -5.75]],
    manhole: { x: 11.2, z: -14.0 },
    patches: [[10.5, -14.5, 2, 3, 0], [-5.5, -9.5, 2, 1, 0], [21.0, -18.5, 3, 2, 1], [6.0, -9.5, 1, 2, 1], [-1.5, -23.0, 1, 1, 0]],
    stains: [[-3.2, -11.3, 2.2, 1], [-0.6, -14.6, 1.6, 0], [10.4, -6.3, 2.6, 1], [12.9, -8.2, 1.3, 0], [4.0, -19.0, 3.0, 1], [0.2, -6.3, 2.4, 1],
      [20.5, -12.3, 3.2, 1], [-4.9, -19.3, 1.1, 0], [7.8, -6.3, 1.1, 0], [-5.4, -6.4, 1.8, 1], [14.3, -17.6, 1.4, 0], [8.5, -17.5, 2.6, 1]],
    // sakura module's own tree pits inside the plaza (young SW tree, forecourt-east tree) — keep them free
    otherPits: [{ x: -7.6, z: -7.8, h: 0.7 }, { x: 19.5, z: -22.0, h: 0.82 }],
    dandelions: [[-8.62, -7.6], [-8.6, -20.3], [25.3, -9.4], [7.3, -5.66], [-4.45, -24.6], [14.72, -22.4], [25.35, -18.3], [-0.4, -5.62], [21.9, -5.66], [-7.2, -5.64], [2.2, -19.95]],
  };
  const fc = L.STATION.forecourt;
  P.isBusy = (x, z) => {
    if (x > fc.x0 - 0.1 && x < fc.x1 + 0.1 && z < fc.z1 + 0.1) return true;
    if (Math.hypot(x - P.tree.x, z - P.tree.z) < P.circleR + 0.3) return true;
    const b = P.bikeArea; if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3) return true;
    for (const t of P.tactile) if (x > t[0] - 0.35 && x < t[2] + 0.35 && z > t[1] - 0.35 && z < t[3] + 0.35) return true;
    for (const d of P.beds) if (x > d.x0 - 0.25 && x < d.x1 + 0.25 && z > d.z0 - 0.25 && z < d.z1 + 0.25) return true;
    if (x > 8.6 && x < 12.4 && z > -7.5 && z < -5.2) return true;
    for (const v of L.VENDING) if (Math.abs(x - v.x) < 0.8 && Math.abs(z - v.z) < 0.8) return true;
    for (const t of P.otherPits) if (Math.abs(x - t.x) < t.h + 0.2 && Math.abs(z - t.z) < t.h + 0.2) return true;
    return false;
  };

  const root = new THREE.Group(); root.name = 'plaza';
  ctx.addStatic(root);
  // The core batcher (batch2) bakes colours into vertex colours and merges materials whose options match.
  // Untextured props used many slightly different `paint` amounts -> quantise them so they share batches.
  const pctx = Object.create(ctx);
  pctx.mat = Object.assign(Object.create(ctx.mat), {
    toon: (c, o = {}) => {
      const p = o.paint ?? 0.05;
      if (!o.map && !o.alphaMap && !o.transparent && p < 0.08) o = { ...o, paint: 0.04 };
      else if (o.map && o.map.wrapS === THREE.RepeatWrapping && !o.transparent && p >= 0.03 && p <= 0.07) o = { ...o, paint: 0.05 };
      return ctx.mat.toon(c, o);
    },
  });
  const T = makeTextures(pctx);
  const S = makeSigns(pctx, T);
  buildGround(pctx, root, T, S, P);
  const ring = buildTree(pctx, root, T, P);
  const furn = buildFurniture(pctx, root, T, S, P);
  buildPlants(pctx, root, T, P);

  ctx.services.plaza = { benches: [...ring, ...furn.benches] };
}
