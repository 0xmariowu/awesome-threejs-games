// ============================================================================
//  WORLD LAYOUT CONTRACT — single source of truth shared by every module.
//  Units: meters.  +Y up.  +X = east, -X = west, -Z = north, +Z = south.
//  Model convention: every model's "front / forward" is its local +Z.
//  rotY follows three.js (rotation.y): rotY=0 faces +Z (south), rotY=PI faces -Z
//  (north), rotY=+PI/2 faces +X (east), rotY=-PI/2 faces -X (west).
//  Camera yaw (degrees) for shots / player: 0 looks north (-Z), 90 west, 180 south, -90 east.
// ============================================================================

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- names
export const NAMES = {
  company: '桜川電鉄', companyEn: 'Sakuragawa Railway', line: '桜川線', lineEn: 'Sakuragawa Line',
  lineColor: '#ef9fbe', lineColorDeep: '#d9718f',
  station: '桜ヶ丘', stationKana: 'さくらがおか', stationEn: 'Sakuragaoka', stationNo: 'SK07',
  prev: { kanji: '花見台', kana: 'はなみだい', en: 'Hanamidai', no: 'SK06', dir: 'west' },
  next: { kanji: '春日野', kana: 'かすがの', en: 'Kasugano', no: 'SK08', dir: 'east' },
  town: '桜ヶ丘町', shoppingStreet: '桜ヶ丘駅前商店街',
};

// ---------------------------------------------------------------- playable bounds
export const WORLD = {
  play: { x0: -92, x1: 92, z0: -97, z1: 128 },   // player is clamped inside
  visual: { x0: -700, x1: 700, z0: -900, z1: 700 }, // distant scenery extent
};

// ---------------------------------------------------------------- railway
export const RAIL = {
  zA: -41.0,            // track A (south, next to station building) centerline
  zB: -45.0,            // track B (north) centerline
  gauge: 1.067,         // Japanese narrow gauge (inner rail distance)
  railTopY: 0.15,
  railH: 0.15,          // rail height; rail foot sits at y = 0.0
  sleeperTopY: 0.0,
  ballastTopY: -0.02,
  groundY: -0.30,       // corridor ground level
  corridorZ0: -52.0,    // corridor north boundary
  corridorZ1: -34.0,    // corridor south boundary
  xMin: -420, xMax: 420,
  contactWireY: 5.15,   // overhead contact wire height (rail top + 5.0)
};

export const PLATFORM = {
  y: 1.25,  // platform top surface
  south: { x0: -7, x1: 40, z0: -39.5, z1: -35.5, edgeZ: -39.5 }, // serves track A
  north: { x0: -7, x1: 40, z0: -50.5, z1: -46.5, edgeZ: -46.5 }, // serves track B
  rampX0: 40, rampX1: 46,            // both platforms ramp down (east end) to walkway level
  walkCrossing: { x0: 46, x1: 48.5 }, // 構内踏切 (in-station crossing) across both tracks
  // Fixed spots used by other modules (station builds benches; characters sits a reader on B1)
  benchB1: { x: 18.0, z: -36.15, rotY: Math.PI },  // south platform bench facing the track (north)
};

export const STATION = {
  x0: -4, x1: 12, z0: -35.5, z1: -25.0,  // building footprint (north side opens to south platform)
  floorY: 1.25,
  entrance: { x: 4.0, z: -25.0 },          // main door (south facade, faces the plaza)
  forecourt: { x0: -4, x1: 14, z0: -25.0, z1: -20.5 }, // steps + ramp zone owned by station module
  sideYard: { x0: 12, x1: 27, z0: -35.5, z1: -25.0 },  // east of the building: station garden / toilet / staff bike shed (station)
  westYard: { x0: -9.25, x1: -4, z0: -34.0, z1: -25.0 }, // west of the building (station) — keep it LOW (<1.2 m) for x<-7 (hero view to the crossing)
};

// ---------------------------------------------------------------- trains (shared by trains, station, crossing, petals, characters)
export const TRAIN = {
  cars: 2, carLen: 18.0, width: 2.8,
  floorY: 0.15 + 1.15, roofY: 0.15 + 3.65,
  stopCenterX: 17.0,              // both trains stop centred here (cars centred at 8.0 and 26.0)
  doorOffsets: [-6.0, 0.0, 6.0],  // door centres relative to each car centre (3 doors per side per car)
  doorW: 1.3,
  period: 120,                    // schedule loop (s)
};
/** x of every door centre when a train is stopped at the platform (door position marks use these). */
export const TRAIN_DOORS_X = [-1, 1].flatMap(s => TRAIN.doorOffsets.map(o => TRAIN.stopCenterX + s * TRAIN.carLen / 2 + o)).sort((a, b) => a - b);
/** Timetable within each 120 s loop (t mod 120). A = westbound on track A, B = eastbound on track B. */
export const SCHEDULE = {
  A: { stopped: [0, 48], doors: [2, 44], departMelody: 36, depart: 48, arriveFromEast: [100, 120] },   // passes the crossing ~t 52–59
  B: { enterFromWest: 4, passCrossing: [20, 26], stop: 32, doors: [34, 70], departMelody: 64, depart: 76 },
};

// ---------------------------------------------------------------- bicycle (vehicles builds, characters pose against it)
// bike-local: forward +Z, origin on the ground midway between the wheel contact points.
export const BIKE = { length: 1.75, wheelR: 0.33, wheelbase: 1.08, handlebar: { y: 1.02, z: 0.50, halfW: 0.28 }, saddle: { y: 0.86, z: -0.22 }, basket: { y: 0.92, z: 0.72 } };

// ---------------------------------------------------------------- level crossing (踏切)
export const CROSSING = {
  x: -12.0, roadHalfW: 2.75,      // road R2 passes here
  deckZ0: -47.6, deckZ1: -38.4,   // crossing deck boards between/around rails
  zone: { x0: -17, x1: -7, z0: -52, z1: -34 }, // crossing module owns this
  stopLineSouthZ: -35.3, stopLineNorthZ: -50.7,
};

// ---------------------------------------------------------------- main street (R1)
export const STREET = {
  halfW: 3.0,        // asphalt half width (6 m two-way narrow road)
  sideW: 1.6,        // sidewalk / white-line shoulder width each side (offset 3.0..4.6)
  lotOffset: 4.8,    // lot frontage line offset from centerline
  lotDepth: 14.0,
  z0: 1.0, z1: 130,  // from R3's south edge to the far south
};
/** Main street centerline x at z (gentle curve for z > 28, straight near the station). */
export function streetCenterX(z) {
  if (z <= 28) return 0;
  const t = clamp((z - 28) / 100, 0, 1);
  return 7 * (1 - Math.cos(Math.PI * t)) / 2;
}
/** d(centerX)/dz */
export function streetSlopeX(z) {
  if (z <= 28 || z >= 128) return 0;
  const t = (z - 28) / 100;
  return 7 * Math.PI * Math.sin(Math.PI * t) / 200;
}
/** Frame on the main street at z. side: -1 west, +1 east, 0 centerline.
 *  offset: distance from centerline. Returns {x,z,y,rotY,tx,tz} where rotY makes local +Z face
 *  the street centerline (for side ±1) and (tx,tz) is the unit tangent pointing north (-Z). */
export function streetFrame(z, side = 0, offset = 0) {
  const cx = streetCenterX(z);
  const sx = streetSlopeX(z);
  // tangent along -Z direction (towards station)
  let tx = -sx, tz = -1; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
  // right-hand normal when walking north: east = (-tz, tx)?  north (0,-1) -> east (1,0)
  const nx = -tz, nz = tx; // points east
  const x = cx + nx * offset * side, zz = z + nz * offset * side;
  // local +Z should face the centerline: for west lots face east (+n), for east lots face west (-n)
  const fx = side <= 0 ? nx : -nx, fz = side <= 0 ? nz : -nz;
  const rotY = Math.atan2(fx, fz);
  return { x, z: zz, y: heightAt(x, zz), rotY, tx, tz };
}

// ---------------------------------------------------------------- other roads
// Each road: centerline polyline (x,z) + half width. y comes from heightAt().
export const ROADS = {
  R1: { name: '駅前商店街 (main street)', halfW: 3.0, kind: 'main' }, // centerline = streetCenterX(z), z from 1 to 130
  R2: { name: '踏切道 (crossing road)', halfW: 2.75, kind: 'local', x: -12.0, z0: -88, z1: -5 }, // straight N-S, crosses tracks
  R3: { name: '駅前通り (station-front cross street)', halfW: 3.0, kind: 'local', z: -2.0, x0: -95, x1: 95 }, // E-W
  R4: { name: '線路北の道 (north lane along tracks)', halfW: 2.0, kind: 'lane', z: -55.5, x0: -95, x1: 95 },
  R6: { name: '住宅街の路地 (residential alley)', halfW: 1.5, kind: 'lane', z: -71.0, x0: -85, x1: 85 },
  R5: { name: '河川敷の堤防道 (levee-top path)', halfW: 1.5, kind: 'path', z: -93.0, x0: -130, x1: 130, y: 3.2 },
};

// ---------------------------------------------------------------- plaza
export const PLAZA = {
  x0: -9.25, x1: 26, z0: -25.0, z1: -5.0,     // paved station-front plaza (minus STATION.forecourt)
  tree: { x: -3.0, z: -14.0, benchR: 2.3 },   // big sakura (sakura module) + circular bench (plaza module)
  bikeRows: [ // bicycle parking: plaza builds racks, vehicles fills slots with bikes (rotY PI = front wheel north)
    { z: -10.0, x0: 16.5, x1: 25.0, step: 0.75, rotY: Math.PI },
    { z: -14.5, x0: 16.5, x1: 25.0, step: 0.75, rotY: Math.PI },
  ],
  busStop: { x: 8.0, z: -5.9 },     // bus stop pole on the plaza's R3 edge
  taxiStand: { x: -6.0, z: -5.9 },  // taxi stand sign; vehicles parks a retro taxi on R3 next to it
};

// ---------------------------------------------------------------- lots
// Main street lots. Local lot frame: origin = frontage-center at street level, local +Z faces
// the street, the lot occupies local x in [-w/2, w/2], local z in [-depth, 0].
// Use lotFrame(lot) to get {x,y,z,rotY,w,depth}. Owners build inside a Group placed at that frame.
export const LOTS = [
  // west side (facing east)
  { id: 'W1', side: -1, z0: 2.5, z1: 15.5, owner: 'shopsA', kind: 'konbini' },
  { id: 'W2', side: -1, z0: 15.5, z1: 22.5, owner: 'shopsA', kind: 'flower' },
  { id: 'W3', side: -1, z0: 22.5, z1: 31.5, owner: 'houses', kind: 'house-garden' }, // garden sakura leans over street
  { id: 'W4', side: -1, z0: 31.5, z1: 40.0, owner: 'shopsA', kind: 'bookstore' },
  { id: 'W5', side: -1, z0: 40.0, z1: 49.0, owner: 'houses', kind: 'house' },
  { id: 'W6', side: -1, z0: 49.0, z1: 58.0, owner: 'shopsB', kind: 'bicycle' },
  { id: 'W7', side: -1, z0: 58.0, z1: 68.0, owner: 'houses', kind: 'house' },
  { id: 'W8', side: -1, z0: 68.0, z1: 78.0, owner: 'houses', kind: 'house' },
  { id: 'W9', side: -1, z0: 78.0, z1: 88.5, owner: 'houses', kind: 'house' },
  { id: 'W10', side: -1, z0: 88.5, z1: 98.0, owner: 'houses', kind: 'house' },
  { id: 'W11', side: -1, z0: 98.0, z1: 108.0, owner: 'houses', kind: 'house' },
  { id: 'W12', side: -1, z0: 108.0, z1: 118.0, owner: 'houses', kind: 'house' },
  { id: 'W13', side: -1, z0: 118.0, z1: 128.0, owner: 'houses', kind: 'house' },
  // east side (facing west)
  { id: 'E1', side: 1, z0: 2.5, z1: 14.5, owner: 'shopsA', kind: 'cafe' },
  { id: 'E2', side: 1, z0: 14.5, z1: 22.0, owner: 'shopsB', kind: 'wagashi' },
  { id: 'E3', side: 1, z0: 22.0, z1: 30.5, owner: 'shopsB', kind: 'general' },
  { id: 'E4', side: 1, z0: 30.5, z1: 39.0, owner: 'houses', kind: 'house' },
  { id: 'E5', side: 1, z0: 39.0, z1: 47.5, owner: 'shopsB', kind: 'ramen' },
  { id: 'E6', side: 1, z0: 47.5, z1: 56.0, owner: 'props', kind: 'shrine' },
  { id: 'E7', side: 1, z0: 56.0, z1: 66.0, owner: 'houses', kind: 'house' },
  { id: 'E8', side: 1, z0: 66.0, z1: 76.0, owner: 'houses', kind: 'house' },
  { id: 'E9', side: 1, z0: 76.0, z1: 86.5, owner: 'houses', kind: 'house' },
  { id: 'E10', side: 1, z0: 86.5, z1: 97.0, owner: 'houses', kind: 'house' },
  { id: 'E11', side: 1, z0: 97.0, z1: 107.0, owner: 'houses', kind: 'house' },
  { id: 'E12', side: 1, z0: 107.0, z1: 117.0, owner: 'houses', kind: 'house' },
  { id: 'E13', side: 1, z0: 117.0, z1: 128.0, owner: 'houses', kind: 'house' },
];
export const lotById = (id) => LOTS.find(l => l.id === id);
/** World frame of a main-street lot (see LOTS). */
export function lotFrame(lot) {
  const zm = (lot.z0 + lot.z1) / 2;
  const f = streetFrame(zm, lot.side, STREET.lotOffset);
  return { x: f.x, y: f.y, z: f.z, rotY: f.rotY, w: lot.z1 - lot.z0, depth: STREET.lotDepth };
}
/** Convert lot-local (lx, lz) to world {x,z}. */
export function lotToWorld(lot, lx, lz) {
  const f = lotFrame(lot); const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  return { x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c };
}

// Areas (axis-aligned rectangles) for residential fill, owned by the houses module unless noted.
// front: which side the houses should face ('N','S','E','W' = toward -Z,+Z,+X,-X).
export const BLOCKS = [
  { id: 'NW', x0: -62, x1: -15.5, z0: -33.5, z1: -5.8, front: ['S', 'E'], note: 'south of tracks, west of R2; faces R3 (south) and R2 (east). Keep x>-17.5,z<-30 free (crossing zone + V5). Keep the rear strip z<-31 free (sakura row along the tracks).' },
  { id: 'NE', x0: 27, x1: 62, z0: -33.5, z1: -5.8, front: ['S', 'W'], note: 'east of plaza; faces R3 (south) and the plaza (west). Keep the rear strip z<-31 free (sakura row along the tracks).' },
  { id: 'SWB', x0: -62, x1: -19.5, z0: 2.6, z1: 128, front: ['S', 'E'], note: 'behind west main-street lots (x < streetCenterX(z)-19); faces R3 or back lanes; lower density' },
  { id: 'SEB', x0: 19.5, x1: 62, z0: 2.6, z1: 128, front: ['S', 'W'], note: 'behind east main-street lots (x > streetCenterX(z)+19)' },
  { id: 'N1W', x0: -85, x1: -15.5, z0: -69.3, z1: -57.9, front: ['S'], note: 'north residential row 1 (faces R4)' },
  { id: 'N1E', x0: -8.5, x1: 85, z0: -69.3, z1: -57.9, front: ['S'], note: 'north residential row 1 (faces R4). Keep (-8.7,-58.5) free for vending machine V4' },
  { id: 'N2W', x0: -85, x1: -15.5, z0: -83.5, z1: -72.7, front: ['S'], note: 'north residential row 2 (faces R6 alley)' },
  { id: 'N2E', x0: -8.5, x1: 85, z0: -83.5, z1: -72.7, front: ['S'], note: 'north residential row 2 (faces R6 alley)' },
];
// Far town fill (houses module, low detail boxes+roofs only): rings outside the playable area.
export const FAR_TOWN = [
  { x0: -260, x1: -95, z0: -86, z1: 200 }, { x0: 95, x1: 260, z0: -86, z1: 200 },
  { x0: -95, x1: 95, z0: 131, z1: 240 },
];

// ---------------------------------------------------------------- terrain height
/** Ground height (m) at (x,z). Everyone uses this to sit things on the ground. */
export function heightAt(x, z) {
  // south town gently rises toward the south (street slopes down to the station)
  let h;
  if (z <= 0) h = 0; else if (z < 10) h = 0.028 * z * z / 20; else h = 0.028 * (z - 5);
  // railway corridor (slight cut)
  if (z < -33 && z > -53) {
    const inner = smoothstep(-33, -34, z) * smoothstep(-53, -52, z); // 1 inside the corridor
    let hc = lerp(0, RAIL.groundY, inner);
    // crossing hump: road rises to rail-top level across the tracks
    const dx = Math.abs(x - CROSSING.x);
    if (dx < CROSSING.roadHalfW + 1.5) {
      const wx = 1 - smoothstep(CROSSING.roadHalfW, CROSSING.roadHalfW + 1.5, dx);
      const along = smoothstep(-35.4, -38.4, z) * smoothstep(-50.6, -47.6, z);
      hc = lerp(hc, lerp(0, RAIL.railTopY, along), wx);
    }
    h = hc;
  }
  // north: flat town, then the river levee (堤防) and the river
  if (z < -84) {
    if (z >= -91.5) h = 3.2 * smoothstep(-84, -91.5, z);              // town-side levee slope
    else if (z >= -94.5) h = 3.2;                                        // levee top (path R5)
    else if (z >= -99) h = lerp(3.2, 0.2, smoothstep(-94.5, -99, z));   // river-side slope
    else if (z >= -101) h = lerp(0.2, -1.2, smoothstep(-99, -101, z));  // bank edge
    else if (z >= -116) h = -1.2;                                         // river bed
    else if (z >= -119) h = lerp(-1.2, 0.6, smoothstep(-116, -119, z)); // far bank
    else h = 0.6 + 0.02 * (-119 - z);                                    // fields rising to hills
  }
  return h;
}
export const RIVER = { z0: -101, z1: -116, waterY: -0.45, flowDir: 1 /* flows toward +X */ };

// ---------------------------------------------------------------- utility poles
// Pole bases (x,z). poles module builds them (+ may add more outside the playable area).
// Wires run between consecutive poles of the same run.
export const POLE_RUNS = (() => {
  const main = (side, zs) => zs.map(z => { const f = streetFrame(z, side, 3.45); return { x: f.x, z: f.z }; });
  return {
    R1W: main(-1, [8, 38, 68, 98, 126]),
    R1E: main(1, [23, 53, 83, 113]),
    R3S: [-78, -52, -26, 22, 46, 72].map(x => ({ x, z: 1.45 })),
    R2W: [{ x: -15.2, z: -20 }, { x: -15.2, z: -61 }, { x: -15.2, z: -79 }],
    R4S: [-78, -48, -20, 18, 48, 78].map(x => ({ x, z: -53.05 })),
    R6S: [-62, -32, 4, 34, 64].map(x => ({ x, z: -69.1 })),
  };
})();

// ---------------------------------------------------------------- shared prop spots
// Vending machines (props module builds ALL of them). Neighbours keep a 1.2 x 1.0 m pad clear.
export const VENDING = [
  { id: 'V1a', x: 14.65, z: -24.45, rotY: 0, note: 'station entrance pair, faces plaza (south)' },
  { id: 'V1b', x: 15.75, z: -24.45, rotY: 0 },
  { id: 'V2', x: 30.0, z: -35.95, rotY: Math.PI, y: PLATFORM.y, note: 'south platform, faces the track' },
  { id: 'V3a', x: -5.3, z: 13.9, rotY: Math.PI / 2, note: 'konbini frontage pair, faces main street (east)' },
  { id: 'V3b', x: -5.3, z: 12.8, rotY: Math.PI / 2 },
  { id: 'V4', x: -8.7, z: -58.6, rotY: -Math.PI / 2, note: 'quiet residential corner (R2/R4), faces R2 (west)' },
  { id: 'V5', x: -16.3, z: -30.8, rotY: Math.PI / 2, note: 'near the crossing, faces R2 (east), with bench' },
];

// Story spots (characters + vehicles modules). Positions are ground contact points.
export const SPOTS = {
  crossingGirlBike: { x: -10.4, z: -34.1, rotY: Math.PI },  // bike (vehicles) facing north, waiting at crossing
  crossingGirl: { x: -10.95, z: -34.2, rotY: Math.PI },     // girl (characters) on the bike's left, hands on bar
  crossingCar: { x: -10.6, z: -53.2, rotY: 0 },             // small car (vehicles) waiting on the north side
  crossingPedestrians: { x: -13.8, z: -34.6 },              // 1-2 pedestrians (characters)
  plazaStudents: { x: -1.0, z: -11.4 },                     // students chatting near the tree bench
  treeGirl: { x: -5.4, z: -11.6, rotY: 2.6 },               // girl under the tree, hair/skirt in the wind
  vendingBoy: { x: 14.65, z: -23.55, rotY: Math.PI },       // boy choosing a drink at V1a
  cafeBoard: { x: 4.35, z: 5.2 },                           // café A-frame chalkboard (shopsA)
  cafeStaff: { x: 4.9, z: 5.9, rotY: -Math.PI / 2 },        // café staff arranging the board (characters)
  elderly: { path: [{ x: 3.9, z: 16 }, { x: 3.9, z: 27 }] }, // elderly with shopping bag walking (characters)
  stationStaffGate: { x: 6.0, z: -30.0 },                   // staff at the manned gate window (inside station)
  stationStaffPlatform: { x: 10.0, z: -37.2, y: PLATFORM.y },
  taxi: { x: -6.2, z: -3.4, rotY: Math.PI / 2 },            // retro taxi parked on R3 (vehicles)
  whiteVan: { x: -2.3, z: 72.0, rotY: Math.PI },            // parked kei van on the main street shoulder
  keiCar: { x: 22.0, z: -0.3, rotY: -Math.PI / 2 },         // kei car on R3 shoulder
  // --- more fixed hand-offs between modules
  plazaBenchSeatY: 0.45,                                    // circular bench seat height (plaza builds, characters/petals use)
  calicoCat: { x: -1.25, z: -15.5, y: 0.45, rotY: 2.2 },    // calico cat sitting on the plaza ring bench
  w3Sakura: { x: -7.0, z: 25.2 },                           // W3 garden sakura (sakura) leaning east over the street
  w3Wall: { lx0: -4.3, lx1: 4.3, lz: -0.15, h: 1.3 },       // W3 frontage wall in lot-local coords (houses builds exactly this)
  catWhite: { x: -4.95, z: 29.6, onW3Wall: true, rotY: Math.PI / 2 }, // white cat on the W3 wall top (y = heightAt + 1.3)
  konbiniBikes: [{ x: -5.9, z: 4.4, rotY: -Math.PI / 2 }, { x: -5.9, z: 5.15, rotY: -Math.PI / 2 }], // painted bike line (shopsA), bikes (vehicles)
  bookstoreBike: { x: -5.35, z: 38.6, rotY: Math.PI },
  v5Bench: { x: -16.35, z: -28.9, rotY: Math.PI / 2, seatY: 0.44, len: 1.5 }, // bench next to V5 (props builds)
  blackCat: { x: -16.0, z: -27.6, rotY: 1.2 },              // black cat by the V5 bench (characters)
  gashapon: { x: 5.3, z: 29.3, rotY: -Math.PI / 2, count: 3 }, // capsule toy machines at the general store front (props)
  disasterCabinet: { x: 29.5, z: -7.2, rotY: 0 },           // 防災倉庫 (props)
};
// Spots derived from lot frames (computed once).
SPOTS.bikeShopBikes = [-3.2, -2.4, -1.6].map(lx => { const p = lotToWorld(lotById('W6'), lx, -1.0); return { x: p.x, z: p.z, rotY: lotFrame(lotById('W6')).rotY }; });
SPOTS.shrineSakura = lotToWorld(lotById('E6'), -2.5, -6.5);

// Named areas for the HUD location toast (first match wins).
export const AREAS = [
  { name: '桜ヶ丘駅 1番線ホーム', x0: -7, x1: 46, z0: -40, z1: -35.5 },
  { name: '桜ヶ丘駅 2番線ホーム', x0: -7, x1: 46, z0: -51, z1: -46 },
  { name: '桜ヶ丘駅', x0: -4, x1: 12, z0: -35.5, z1: -25 },
  { name: '桜川線 第一踏切', x0: -17, x1: -7, z0: -52, z1: -34 },
  { name: '駅前広場', x0: -9.25, x1: 26, z0: -25, z1: -5 },
  { name: '駅前通り', x0: -95, x1: 95, z0: -5.5, z1: 1.5 },
  { name: '桜ヶ丘駅前商店街', x0: -12, x1: 14, z0: 1.5, z1: 60 },
  { name: '桜ヶ丘 住宅街', x0: -95, x1: 95, z0: 60, z1: 130 },
  { name: '河川敷 · 桜川堤', x0: -130, x1: 130, z0: -120, z1: -84 },
  { name: '線路北の住宅街', x0: -95, x1: 95, z0: -84, z1: -52 },
  { name: '桜ヶ丘町', x0: -999, x1: 999, z0: -999, z1: 999 },
];

// Hero shot (initial camera). yaw/pitch in degrees (yaw 0 = north).
export const HERO = { x: 1.6, z: 34.0, yaw: 4.0, pitch: 2.0 };

// Sun: direction TO the sun (normalized in core). Late afternoon (~16:00), from the west-southwest.
export const SUN_DIR = [-0.776, 0.517, 0.362];
