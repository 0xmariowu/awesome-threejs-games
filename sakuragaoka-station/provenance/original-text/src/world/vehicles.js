// vehicles — every bicycle in town (plaza racks, shop fronts, the crossing girl's bike, house bike
// spots, bikes leaning on walls) + parked cars (white kei van, pastel kei car, retro taxi) and the small
// car waiting at the level crossing. Geometry: see vehicles/bike.js and vehicles/cars.js.
// Performance: each vehicle is ONE vertex-coloured mesh + ONE atlas mesh (+ glass for cars), all sharing
// a handful of materials, so static batching folds the whole module into a few draw calls per cell.
import * as THREE from 'three';
import { makeBicycle, BIKE_COLORS as BC } from './vehicles/bike.js';
import { makeKeiVan, makeKeiCar, makeTaxi, makeCompact } from './vehicles/cars.js';

export { makeBicycle };

export async function build(ctx) {
  const { L } = ctx;
  const root = new THREE.Group(); root.name = 'vehicles'; ctx.addStatic(root);
  const S = L.SPOTS;
  const hasStreet = !!ctx.services.street;
  const svc = { bikes: [], cars: [] };

  /** surface height: terrain, or the highest walkable top (sidewalk, apron, floor) at most ~0.4 m up */
  const gy = (x, z) => {
    const h = L.heightAt(x, z);
    let g = h;
    try { g = Math.max(h, ctx.physics.groundHeight(x, z, h)); } catch (e) { /* physics optional */ }
    return g;
  };

  // ------------------------------------------------------------------ bicycles
  const placeBike = (x, z, rotY, opts, lift = 0, collide = true) => {
    const b = makeBicycle(ctx, opts);
    const fx = Math.sin(rotY), fz = Math.cos(rotY);
    const hf = gy(x + fx * 0.54, z + fz * 0.54) + lift, hr = gy(x - fx * 0.54, z - fz * 0.54) + lift;
    let y, pitch = 0;
    if (Math.abs(hf - hr) < 0.09) { y = (hf + hr) / 2; pitch = Math.atan2(hr - hf, 1.08); } else y = Math.min(hf, hr);
    b.position.set(x, y - 0.004, z); b.rotation.y = rotY;
    b.children[0].rotation.x = pitch;
    root.add(b);
    if (collide) ctx.physics.addBox(x, z, 0.64, 1.8, rotY, y - 0.05, y + 1.1);
    svc.bikes.push({ x, z, y, rotY });
    return b;
  };

  // --- plaza bicycle parking (L.PLAZA.bikeRows; plaza builds the racks) — 16 of 24 slots
  {
    const lift = ctx.services.plaza ? 0.02 : 0;
    const fill = [
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0],
      [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
    ];
    const cfg = [
      { color: BC.silver, sticker: 'park', bottleDynamo: true },
      { color: BC.mint, childSeat: 'rear', rainCover: '#5b6a8f', electric: true, childSeatColor: '#8e959f' },
      { color: BC.white, saddleCover: '#eaa3b8', sticker: 'park' },
      { color: BC.navy, basketColor: '#4c4a55', steer: 0.42, askew: 0.07 },
      { color: BC.cream, childSeat: 'front', electric: true, umbrella: true, childSeatColor: '#b9b3a4' },
      { color: BC.red, sticker: 'park' },
      { color: BC.black, basketColor: '#4c4a55', saddleCover: '#d8cdb4' },
      { color: BC.blue, basketColor: '#e4e2dc', umbrella: true, sticker: 'park' },
      { color: BC.silver, childSeat: 'rear', electric: true, childSeatColor: '#7a8290' },
      { color: BC.white, bottleDynamo: true, sticker: 'park' },
      { color: BC.mint, saddleCover: '#9fc9b8', steer: -0.34, askew: -0.09 },
      { color: BC.navy, electric: true, childSeat: 'rear', rainCover: '#9aa3ad', childSeatColor: '#5e6778' },
      { color: BC.cream, contents: 'groceries', bagColor: '#b9d0c4' },
      { color: BC.black, sticker: 'park' },
      { color: BC.red, saddleCover: '#44507a' },
      { color: BC.silver, umbrella: true, basketColor: '#4c4a55' },
    ];
    let k = 0;
    const rr = ctx.rng('vehicles-plaza');
    L.PLAZA.bikeRows.forEach((row, ri) => {
      let i = 0;
      for (let x = row.x0; x <= row.x1 + 1e-6; x += row.step, i++) {
        if (!fill[ri][i]) continue;
        const c = cfg[k % cfg.length]; k++;
        const ask = c.askew || 0;
        placeBike(x + ask * 0.6, row.z + (ask ? 0.06 : 0), row.rotY + ask, {
          seed: 'plaza' + k, steer: c.steer ?? rr.range(-0.12, 0.12), ...c,
        }, lift);
      }
    });
  }

  // --- shop fronts
  const konbini = [
    { color: BC.white, contents: 'groceries', saddleCover: '#eaa3b8' },
    { color: BC.blue, steer: 0.18 },
  ];
  S.konbiniBikes.forEach((p, i) => placeBike(p.x, p.z, p.rotY, { seed: 'konbini' + i, ...konbini[i % 2] }, 0.01));
  placeBike(S.bookstoreBike.x, S.bookstoreBike.z, S.bookstoreBike.rotY, { seed: 'book', color: BC.navy, basketColor: '#4c4a55', steer: -0.1, electric: true }, 0.01);
  // bicycle shop (サイクル丸山): three new bikes with price tags
  const newBikes = [
    { color: BC.mint, tag: 'tag1' }, { color: BC.cream, tag: 'tag2' }, { color: '#9cc0e6', tag: 'tag3' },
  ];
  S.bikeShopBikes.forEach((p, i) => placeBike(p.x, p.z, p.rotY, {
    seed: 'shop' + i, isNew: true, basketColor: '#cfd3d8', fenderColor: '#d8dbdf', rackColor: '#d8dbdf', caseColor: newBikes[i].color,
    saddleColor: '#4c4957', brand: i === 1 ? 2 : 1, steer: 0, crank: 0.4, ...newBikes[i],
  }, 0.035));

  // --- the girl waiting at the crossing (characters stands her on the bike's left, hands on the grips)
  {
    const p = S.crossingGirlBike;
    placeBike(p.x, p.z, p.rotY, { seed: 'girl', color: BC.mint, contents: 'bag', stand: 'up', steer: 0, crank: 2.2, basketColor: '#c4c8cd', saddleColor: '#5a4438' }, hasStreet ? 0.02 : 0);
  }

  // --- houses' bike spots (fallback: a few spots in front of house lots)
  {
    let spots = ctx.services.houses?.bikeSpots;
    if (!spots || !spots.length) {
      spots = [];
      for (const id of ['W5', 'W7', 'E4', 'E7', 'W9', 'E9']) {
        const lot = L.lotById(id), f = L.lotFrame(lot), p = L.lotToWorld(lot, 3.2, -2.4);
        spots.push({ x: p.x, z: p.z, rotY: f.rotY + Math.PI / 2 });
      }
    }
    const rh = ctx.rng('vehicles-houses');
    const palette = [BC.silver, BC.white, BC.cream, BC.mint, BC.navy, BC.blue, BC.red, BC.black, BC.pink, BC.green];
    const max = 11;
    spots.slice(0, max).forEach((p, i) => {
      const near = Math.abs(p.x - L.streetCenterX(p.z)) < 22 && p.z > -60 && p.z < 130;
      const fam = rh.chance(0.45);
      placeBike(p.x, p.z, p.rotY, {
        seed: 'house' + i, lod: near ? 1 : 0, color: palette[i % palette.length],
        electric: fam && rh.chance(0.7),
        childSeat: fam ? (rh.chance(0.65) ? 'rear' : 'front') : null,
        rainCover: fam && rh.chance(0.4) ? rh.pick(['#5b6a8f', '#9aa3ad', '#c98fa2']) : null,
        saddleCover: rh.chance(0.35) ? rh.pick(['#eaa3b8', '#9fc9b8', '#d8cdb4', '#8fb3d9']) : null,
        contents: rh.chance(0.18) ? 'groceries' : 'none', umbrella: rh.chance(0.2), steer: rh.range(-0.25, 0.25),
        bottleDynamo: rh.chance(0.4),
      }, 0.01);
    });
  }

  // --- bikes leaning on walls (kickstand up, handlebar end against the wall)
  const LEAN = 0.14, OFF = 0.49;
  const leanOn = (wx, wz, dirX, dirZ, along, opts) => {
    // (wx,wz) = point on the wall face, (dirX,dirZ) = unit normal pointing away from the wall, along = +1/-1 facing
    const x = wx + dirX * OFF, z = wz + dirZ * OFF;
    const rotY = Math.atan2(-dirZ * along, dirX * along);          // bike forward is perpendicular to the normal
    // bike local +X in world = (cos rotY, -sin rotY); lean toward the wall
    const lx = Math.cos(rotY), lz = -Math.sin(rotY);
    const towardWallIsPlusX = (lx * -dirX + lz * -dirZ) > 0;
    return placeBike(x, z, rotY, { stand: 'up', lean: towardWallIsPlusX ? -LEAN : LEAN, ...opts }, 0.005);
  };
  // station staff bicycle shed (職員用駐輪場, station builds shed + front-wheel slots at x 22.75 + 0.62 i, z -32.5)
  if (ctx.services.station) {
    const staff = [{ i: 0, color: BC.black, basketColor: '#4c4a55' }, { i: 2, color: BC.silver, electric: true }, { i: 3, color: BC.navy, saddleCover: '#8fb3d9', steer: 0.2 }];
    for (const s of staff) placeBike(22.75 + 0.62 * s.i, -31.98, Math.PI, { seed: 'staff' + s.i, sticker: null, ...s }, 0.004);
  }
  // W3 frontage wall, on the sidewalk (street life in the hero view)
  {
    const lot = L.lotById('W3'), f = L.lotFrame(lot);
    const p = L.lotToWorld(lot, 2.4, S.w3Wall.lz + 0.075);
    const nx = Math.sin(f.rotY), nz = Math.cos(f.rotY);
    leanOn(p.x, p.z, nx, nz, 1, { seed: 'lean-w3', color: BC.red, saddleCover: '#44507a', steer: -0.06 });
  }
  // a wall of the NW block along R2 (from houses' wallTops, if any)
  {
    const walls = (ctx.services.houses?.wallTops || []).filter(w => w.len >= 2.0 && w.x > -48 && w.x < -17 && w.z > -8 && w.z < -4.5 && Math.abs(Math.cos(w.rotY)) > 0.9);
    walls.sort((a, b) => Math.abs(a.x + 24) - Math.abs(b.x + 24));
    const w = walls[0];
    if (w) {
      const nx = Math.sin(w.rotY), nz = Math.cos(w.rotY);
      leanOn(w.x + 0.8 + nx * 0.1, w.z + nz * 0.1, nx, nz, -1, { seed: 'lean-nw', color: BC.cream, basketColor: '#4c4a55', childSeat: 'rear', childSeatColor: '#8e959f' });
    }
  }

  // ------------------------------------------------------------------ cars
  const roadLift = hasStreet ? 0.02 : 0;
  const placeCar = (car, x, z, rotY, lift = roadLift) => {
    const d = car.userData.dims;
    const fx = Math.sin(rotY), fz = Math.cos(rotY);
    const hF = L.heightAt(x + fx * d.wb / 2, z + fz * d.wb / 2) + lift, hR = L.heightAt(x - fx * d.wb / 2, z - fz * d.wb / 2) + lift;
    const y = (hF + hR) / 2 - 0.012;
    car.position.set(x, y, z); car.rotation.y = rotY;
    car.userData.inner.rotation.x = Math.atan2(hR - hF, d.wb);
    root.add(car);
    const zc = (d.zF + d.zR) / 2, len = d.zF - d.zR;
    ctx.physics.addBox(x + fx * zc, z + fz * zc, d.W + 0.08, len, rotY, y - 0.1, y + d.H);
    svc.cars.push({ name: car.name, x, z, y, rotY, W: d.W, L: len, roofY: y + d.H });
    return car;
  };
  // white kei van on the west shoulder of the main street (facing north, left-hand traffic)
  {
    const z = S.whiteVan.z;
    const f = L.streetFrame(z, -1, 2.0);
    placeCar(makeKeiVan(ctx), f.x, f.z, Math.atan2(f.tx, f.tz));
  }
  placeCar(makeKeiCar(ctx), S.keiCar.x, S.keiCar.z, S.keiCar.rotY);
  placeCar(makeTaxi(ctx), S.taxi.x, S.taxi.z, S.taxi.rotY);
  placeCar(makeCompact(ctx), S.crossingCar.x, S.crossingCar.z, S.crossingCar.rotY);

  ctx.services.vehicles = svc;
}
