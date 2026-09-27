// The people of 桜ヶ丘: specs (look) + behaviours (deterministic idle / gestures / walking).
import * as THREE from 'three';
import { Human } from './human.js';
import { Driver, rot, rotMul } from './anim.js';
import * as gear from './gear.js';
import { clamp, lerp, smooth, wave, DEG, TAU } from './skin.js';

// ------------------------------------------------------------------ palettes
const HAIR = {
  blue: { top: '#4a4660', base: '#3f3c52', tip: '#3b374b', hi: '#716f90', hi2: '#9a98b8' },
  dark: { top: '#5d4743', base: '#4f3c3e', tip: '#47383c', hi: '#8c706a', hi2: '#b3978c' },
  chestnut: { top: '#8d6552', base: '#785642', tip: '#6a4b3d', hi: '#b89076', hi2: '#d6b59a' },
  soft: { top: '#9b7662', base: '#876550', tip: '#775a49', hi: '#c3a187', hi2: '#dcc0a6' },
  gray: { top: '#bdb9c3', base: '#aca8b4', tip: '#a19dab', hi: '#dbd8e0', hi2: '#e6e3ea' },
  black: { top: '#49404a', base: '#403840', tip: '#3c343e', hi: '#6f6470', hi2: '#948896' },
};
const SKIN = { fair: '#f6dccb', warm: '#f3d5c1', tan: '#ebc8b0', old: '#efd2c1' };

function faceF(o = {}) {
  return { skin: SKIN.fair, ink: '#3b3144', eyeP: 24, eyeT: -12, eyeW: 20, eyeH: 22, irisDark: '#4a3346', irisMid: '#7d5b62', irisLight: '#c69f8f',
    lash: 1, lidTop: -0.5, iris: 0.37, irisH: 0.46, brow: '#5c4448', browW: 1.7, browGap: 3.5, browArch: 2.4, noseT: -32, mouthT: -52, mouthW: 9, smile: 0.3, blush: 0.75, blushLines: true, ...o };
}
function faceM(o = {}) {
  return faceF({ eyeW: 19, eyeH: 15, lash: 0.5, lidTop: -0.48, iris: 0.36, irisH: 0.5, browW: 2.6, browArch: 1.2, browGap: 3, blush: 0.25, blushLines: false, mouthW: 10, smile: 0.1, ...o });
}

const STRIPES = { base: '#44507a', line: '#eeebe6', bands: [[0.74, 0.8], [0.86, 0.91]] };
const PLAID = { base: '#6c7690', band: '#8c96ad', dark: '#4d5670', line: '#c7b27e' };
const UNIFORM = { navy: '#434e6d', navyDark: '#3a4461', shirt: '#eceae5' };

// ------------------------------------------------------------------ factory helpers
function person(ctx, spec) {
  const h = new Human(ctx, spec);
  ctx.add(h.group);
  return h;
}
function collider(ctx, x, z, y, r = 0.24, hgt = 1.65) { ctx.physics.addCylinder(x, z, r, y, y + hgt); }

/** ground under a spot (walk boxes of plaza/street/station included) */
export function groundAt(ctx, x, z) {
  const g0 = ctx.L.heightAt(x, z);
  return ctx.physics.groundHeight(x, z, g0 + 0.2);
}

/** Is there a small object (e.g. the vehicles module's bicycle) whose bounds contain world point p?
 *  Used so the crossing girl only grips a handlebar that actually exists. */
function somethingAt(ctx, p, pad = 0.2, maxSize = 3) {
  const box = new THREE.Box3(), size = new THREE.Vector3();
  let found = false;
  for (const root of [ctx.staticRoot, ctx.dynamicRoot]) {
    if (!root || found) continue;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (found || !o.isMesh || o.isInstancedMesh || !o.geometry) return;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      box.getSize(size);
      if (Math.max(size.x, size.y, size.z) > maxSize) return;
      box.expandByScalar(pad);
      if (box.containsPoint(p)) found = true;
    });
  }
  return found;
}

// ------------------------------------------------------------------ the cast
export function makeCast(ctx) {
  const L = ctx.L, S = L.SPOTS;
  const actors = [];
  const W = ctx.shared.uWind.value;
  const railTrain = (track) => { const r = ctx.services.rail; if (!r || !r.trains) return null; return r.trains.find(t => t.track === track) || null; };

  // ============================================================ 1. station staff (gate)
  {
    const spot = S.stationStaffGate, y = L.STATION.floorY;
    const h = person(ctx, staffSpec('staffGate', 1.7, 11, HAIR.black));
    const d = new Driver(ctx, h, { seed: 11 });
    const rotY = 0; // faces the gate aisle / entrance (south)
    collider(ctx, spot.x, spot.z, y);
    actors.push({ h, update(t, dt) {
      d.place(spot.x, y, spot.z, rotY); d.reset();
      const c = t % 22;
      const bow = smooth(8, 8.6, c) * (1 - smooth(9.4, 10.2, c));      // small nod to a passenger
      const paper = smooth(14, 15, c) * (1 - smooth(19, 20, c));        // checks the counter
      d.stand({ hx: 0.012 * Math.sin(t * 0.45), hrz: 0.012 * Math.sin(t * 0.45), hrx: 0.1 * bow + 0.05 * paper });
      rotMul(h.b.spine, 0.12 * bow + 0.12 * paper, 0, 0); rotMul(h.b.chest, 0.08 * bow, 0, 0);
      d.breathe(t);
      d.arm('L', 0.08 + 0.5 * paper, 0.1, 0, 0.25 + 0.9 * paper, [0, 0, 0]);
      d.arm('R', 0.08 + 0.45 * paper, 0.1, 0, 0.25 + 1.0 * paper, [0, 0, 0]);
      const yaw = 0.5 * Math.sin(t * 0.21) + 0.25 * wave(t * 0.3, 3);
      d.lookYP(yaw * (1 - paper), 0.08 + 0.5 * paper + 0.3 * bow, dt, { speed: 2 });
      d.blink(t);
    } });
  }

  // ============================================================ 2. station staff (platform) — watches the train, raises a hand
  {
    const spot = S.stationStaffPlatform, y = spot.y;
    const h = person(ctx, staffSpec('staffPlat', 1.73, 12, HAIR.dark, { point: true }));
    const d = new Driver(ctx, h, { seed: 12 });
    const rotY = Math.PI + 0.35; // faces the track (north), turned a little toward the train's front (west)
    collider(ctx, spot.x, spot.z, y);
    actors.push({ h, update(t, dt) {
      d.place(spot.x, y, spot.z, rotY); d.reset();
      const c = t % 120;
      // pointing check (指差確認) and the departure "all clear" hand
      const point = smooth(16, 16.6, c) * (1 - smooth(19, 19.8, c)) + smooth(40, 40.6, c) * (1 - smooth(42.6, 43.3, c));
      const raise = smooth(44.5, 45.2, c) * (1 - smooth(48.2, 49, c)) + smooth(72, 72.7, c) * (1 - smooth(75.6, 76.4, c));
      d.stand({ hx: 0.015 * Math.sin(t * 0.37 + 1), hrz: 0.015 * Math.sin(t * 0.37 + 1), stance: 1.3 });
      d.breathe(t);
      // arms: left hand behind the back, right arm points / raises
      d.arm('L', -0.32, 0.14, -1.2, 1.4, [0.2, 0, 0]);
      const fwdR = lerp(0.1, 1.45, point) + raise * 2.55, outR = lerp(0.12, 0.35, point) + raise * 0.15;
      d.arm('R', Math.min(fwdR, 2.7), outR, 0, lerp(0.2, 0.05, Math.max(point, raise)) + raise * 0.1, [0, 0, 0]);
      // look along the train (toward its front, west) or at the far track
      const tr = railTrain('A');
      let yaw = 0.35 * Math.sin(t * 0.13) + 0.2;
      if (tr && Math.abs(tr.x - spot.x) < 40) yaw = clamp(Math.atan2(-(tr.x - tr.dir * tr.length * 0.45 - spot.x), 2.5) * -1, -1.1, 1.1) * 0.6;
      if (point > 0.2) yaw = lerp(yaw, 0.1, point);
      d.lookYP(yaw, 0.04, dt, { speed: 1.5 });
      d.blink(t);
    } });
  }

  // ============================================================ 3. schoolgirl with her bike at the crossing
  {
    const bs = S.crossingGirlBike, BK = L.BIKE;
    // bike-local frame (+x = the bike's left). She stands close beside the frame, ~0.3 m behind the bar,
    // so her left hand reaches the left grip and her right hand rests on the bar beside the stem.
    const bl = (lx, lz) => ({ x: bs.x + lx * Math.cos(bs.rotY) + lz * Math.sin(bs.rotY), z: bs.z - lx * Math.sin(bs.rotY) + lz * Math.cos(bs.rotY) });
    const spot = bl(0.36, 0.2);
    const y = groundAt(ctx, spot.x, spot.z);
    const by = groundAt(ctx, bs.x, bs.z);
    // only grip the handlebar if the vehicles module really parked her bike there
    const barC = new THREE.Vector3(bs.x + Math.sin(bs.rotY) * BK.handlebar.z, by + BK.handlebar.y, bs.z + Math.cos(bs.rotY) * BK.handlebar.z);
    const hasBike = somethingAt(ctx, barC, 0.15);
    const h = person(ctx, {
      key: 'crossGirl', sex: 'f', height: 1.57, seed: 21, skin: SKIN.fair,
      face: faceF({ irisDark: '#3e3a58', irisMid: '#5f6488', irisLight: '#a9b0cc' }),
      hair: { style: 'pony', fringe: { n: 7, span: 60, tip: 3, skew: 7, w: 0.052 }, side: { long: 0.07, w: 0.03 }, ponytail: { len: 0.36, th: 30, w: 0.07, tie: '#c86a78' }, hairlineBack: -62 },
      hairTex: HAIR.blue, stripes: STRIPES,
      outfit: { top: 'sailor', topColor: '#eeebe6', scarf: '#c9707c', bottom: 'pleats', bottomColor: '#4b5576', hem: 0.53, pleats: 18,
        socks: { color: '#454d6a', top: 0.78 }, shoes: { color: '#5b4336', sole: '#4a3a36' } },
      hands: hasBike ? { L: 'grip', R: 'relax' } : { L: 'relax', R: 'hold' },
      props: [(hh) => gear.shoulderBag(hh, { color: '#475072', charm: '#f2b5c8' }), (hh) => gear.watch(hh, 'L', '#b88a8a')],
    });
    const d = new Driver(ctx, h, { seed: 21, hairAmp: 1.1 });
    const rotY = hasBike ? bs.rotY - 0.42 : bs.rotY - 0.15;   // beside the bike, turned toward it
    collider(ctx, spot.x, spot.z, y);
    const grip = (sx) => { const lx = sx * BK.handlebar.halfW, lz = BK.handlebar.z, c = Math.cos(bs.rotY), s = Math.sin(bs.rotY); return new THREE.Vector3(bs.x + lx * c + lz * s, by + BK.handlebar.y, bs.z - lx * s + lz * c); };
    const gL = grip(1);
    const barP = (() => { const p = bl(0.07, BK.handlebar.z - 0.01); return new THREE.Vector3(p.x, by + BK.handlebar.y, p.z); })();
    const tgtL = new THREE.Vector3(), tgtR = new THREE.Vector3(), pole = new THREE.Vector3(), look = new THREE.Vector3();
    actors.push({ h, update(t, dt) {
      d.place(spot.x, y, spot.z, rotY); d.reset();
      const sh = Math.sin(t * 0.31 + 0.4);
      d.stand({ hx: 0.018 * sh, hrz: 0.02 * sh, hry: 0.08, hz: 0.01, footL: [0.1, h.P.ankle, -0.04], footR: [-0.075, h.P.ankle, 0.06], toeL: 0.25, toeR: 0.05 });
      rotMul(h.b.spine, 0.06, 0.12, 0); rotMul(h.b.chest, 0.04, 0.08, 0);
      d.breathe(t);
      if (hasBike) {
        // hands on the grips (wrist a little behind/above the grip)
        tgtL.copy(gL).add(new THREE.Vector3(0.0, 0.03, 0.035)); tgtR.copy(barP).add(new THREE.Vector3(0, 0.045, 0.03));
        d.armIK('L', tgtL, d.W(0.45, 0.95, -0.45, pole));
        d.armIK('R', tgtR, d.W(-0.5, 0.9, -0.5, pole));
        rot(h.b.handL, 0.35, 0.3, -0.5); rot(h.b.handR, 0.9, -0.5, 0.2);
      } else {
        // no bike in the scene: waits with her right hand on the bag strap, left arm hanging
        d.arm('L', 0.04, 0.1, 0, 0.18, [0, 0, 0]);
        d.arm('R', 0.3, 0.05, -0.55, 1.55, [0.1, 0.2, 0]);
      }
      // watch the train passing the crossing (B, eastbound) or glance at the warning lights
      const tr = railTrain('B');
      if (tr && tr.x > -45 && tr.x < 25) look.set(clamp(tr.x, -30, 10), 2.0, L.RAIL.zB);
      else look.set(-11.2 + 2.5 * Math.sin(t * 0.17), 1.8 + 0.6 * Math.sin(t * 0.23), -42 - 2 * Math.cos(t * 0.11));
      d.lookAt(look, dt, { speed: 2.5, maxYaw: 1.0, maxUp: 0.35 });
      d.wind(t, dt);
      d.blink(t);
    } });
  }

  // ============================================================ 4. pedestrians waiting at the crossing
  {
    const base = S.crossingPedestrians;
    const pw = { x: base.x + 0.35, z: base.z + 0.12 }, pm = { x: base.x - 0.55, z: base.z - 0.28 };
    const yw = groundAt(ctx, pw.x, pw.z), ym = groundAt(ctx, pm.x, pm.z);
    const hw = person(ctx, {
      key: 'pedWoman', sex: 'f', height: 1.6, seed: 31, skin: SKIN.warm,
      face: faceF({ eyeH: 19, lidTop: -0.46, irisMid: '#7a5a50', irisLight: '#b8957c', blush: 0.5, smile: 0.2 }),
      hair: { fringe: { n: 6, span: 58, tip: 8, skew: 14, w: 0.056, part: 4, partAt: -10 }, hairlineSide: -60, hairlineBack: -74, flare: 0.14, side: { w: 0.04 } },
      hairTex: HAIR.chestnut,
      outfit: { top: 'cardigan', topColor: '#e6c9c6', band: '#dcbab8', shirt: '#f0ebdf', vAng: 30, vY: 0.95, bottom: 'skirt', bottomColor: '#d8c8aa', hem: 0.24, flare: 0.13, legs: '#ecd0bc', shoes: { color: '#8a6a58', sole: '#6a5448' } },
      hands: { R: 'hold' },
      props: [(hh) => gear.handBag(hh, 'R', { w: 0.34, h: 0.3, d: 0.1, color: '#b9c3a6', handle: '#a7b194', drop: 0.05, logo: '#d9dccb' })],
    });
    const hm = person(ctx, {
      key: 'pedMan', sex: 'm', height: 1.74, seed: 32, skin: SKIN.warm, ears: true,
      face: faceM({ irisMid: '#5d4a44', irisLight: '#8f7564', eyeH: 14, browW: 2.8 }),
      hair: { fringe: { n: 5, span: 50, tip: 18, skew: 16, w: 0.06, part: 6, partAt: -14, edgeDrop: 10 }, hairlineSide: -8, hairlineBack: -64, volume: 1.07, crown: [[160, 20, 10, 0.06], [-160, 20, -10, 0.06]] },
      hairTex: HAIR.dark,
      outfit: { top: 'jacket', topColor: '#a4a8b0', lapel: '#9a9ea7', shirt: '#eceae6', tie: '#5b6e90', buttons: '#6f737b', vAng: 30, vY: 0.72, bottom: 'trousers', bottomColor: '#8f939b', belt: '#4e4a4c', pockets: true,
        shoes: { color: '#4f4444', sole: '#3f3838' } },
      hands: { L: 'hold', R: 'hold' },
      props: [(hh) => gear.handBag(hh, 'L', { w: 0.4, h: 0.29, d: 0.08, color: '#5d4e48', handle: '#4f423d', drop: 0.02, handleW: 0.016 }), (hh) => gear.phone(hh, 'R')],
    });
    const dw = new Driver(ctx, hw, { seed: 31 }), dm = new Driver(ctx, hm, { seed: 32 });
    collider(ctx, pw.x, pw.z, yw); collider(ctx, pm.x, pm.z, ym, 0.26, 1.75);
    const look = new THREE.Vector3();
    actors.push({ h: hw, update(t, dt) {
      dw.place(pw.x, yw, pw.z, Math.PI - 0.12); dw.reset();
      const sh = Math.sin(t * 0.27 + 2);
      dw.stand({ hx: 0.02 * sh, hrz: 0.022 * sh, footL: [0.075, hw.P.ankle, 0.02], footR: [-0.085, hw.P.ankle, -0.03] });
      dw.breathe(t);
      dw.arm('R', 0.02, 0.1, 0, 0.12, [0, 0, 0]);
      dw.arm('L', 0.16, 0.04, -0.75, 1.45, [0.1, 0.3, 0]);   // left hand resting at the cardigan's front, at the waist
      const tr = railTrain('B');
      if (tr && tr.x > -60 && tr.x < 40) look.set(clamp(tr.x, -40, 30), 2.4, L.RAIL.zB); else look.set(-12, 2.4 + Math.sin(t * 0.2), -44);
      dw.lookAt(look, dt, { speed: 2 });
      dw.wind(t, dt);
      dw.blink(t);
    } });
    actors.push({ h: hm, update(t, dt) {
      dm.place(pm.x, ym, pm.z, Math.PI + 0.25); dm.reset();
      const sh = Math.sin(t * 0.23);
      dm.stand({ hx: 0.015 * sh, hrz: 0.015 * sh, stance: 1.15 });
      dm.breathe(t);
      dm.arm('L', 0.02, 0.06, 0, 0.1, [0, 0, 0]);
      const phoneUp = 1 - smooth(9, 10, t % 16) * (1 - smooth(13, 14, t % 16));  // looks up at the crossing now and then
      dm.arm('R', 0.55 * phoneUp + 0.05, 0.05, -0.2, 1.7 * phoneUp + 0.1, [0.3 * phoneUp, 0, 0]);
      dm.lookYP(0.1 * (1 - phoneUp) + 0.05, lerp(-0.08, 0.72, phoneUp), dt, { speed: 2.5 });
      dm.blink(t);
    } });
  }

  // ============================================================ 5. reader on platform bench B1
  {
    const bn = L.PLATFORM.benchB1, floor = L.PLATFORM.y, seat = floor + 0.44;
    let bx = bn.x, bz = bn.z, brot = bn.rotY;
    const h = person(ctx, {
      key: 'reader', sex: 'm', height: 1.72, seed: 41, skin: SKIN.fair, ears: true,
      face: faceM({ irisMid: '#5f5258', irisLight: '#8f8088', eyeH: 14, lidTop: -0.4 }),
      hair: { fringe: { n: 6, span: 56, tip: 6, skew: 10, w: 0.055, edgeDrop: 14 }, hairlineSide: -18, hairlineBack: -68, volume: 1.08, side: { w: 0.028 }, crown: [[150, -10, 20, 0.06], [-150, -10, -20, 0.06], [180, -20, 0, 0.07]] },
      hairTex: HAIR.dark,
      outfit: { top: 'sweater', topColor: '#afbfa3', band: '#9fb094', shirtCollar: '#eeebe4', bottom: 'trousers', bottomColor: '#cdbd9f', belt: null,
        shoes: { color: '#e4e1db', sole: '#cfc9c1', accent: '#8a9fb8', type: 'sneaker' } },
      hands: { L: 'hold', R: 'hold' },
      props: [(hh) => gear.glasses(hh, { color: '#6b5a57' }), (hh) => { hh._book = gear.book(hh, { cover: '#c7836a' }); },
        (hh) => { // messenger bag beside him on the bench (root bone)
          const k = hh.P.k; hh.add(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).scale(0.36, 0.26, 0.1), { bone: hh.b.root, color: '#7c8aa0', matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.25, 0.3, 0)).setPosition(-0.52, 0.44 + 0.002, -0.05) });
        }],
    });
    const d = new Driver(ctx, h, { seed: 41 });
    const bk = h._book;
    collider(ctx, bx, bz, floor, 0.3, 1.3);
    const eL = new THREE.Vector3(), eR = new THREE.Vector3(), pole = new THREE.Vector3(), tmp = new THREE.Vector3();
    actors.push({ h, update(t, dt) {
      d.place(bx, floor, bz, brot); d.reset();
      const P = h.P, b = h.b;
      // pelvis on the seat, slightly back
      b.hips.position.set(0, seat - floor + 0.075 + (P.hip - P.hipJy), -0.1);
      rotMul(b.hips, -0.08, 0, 0);
      h.group.updateMatrixWorld(true);
      d.leg('L', [0.11, P.ankle, 0.34], 0.12, [0.1, 1]); d.leg('R', [-0.12, P.ankle, 0.4], -0.08, [0.1, 1]);
      rotMul(b.spine, 0.16, 0, 0); rotMul(b.chest, 0.12, 0, 0);
      d.breathe(t, 0.8);
      // book in front of the chest, tilted toward the face
      const turnC = t % 15, turn = smooth(11.6, 12.6, turnC);
      bk.book.position.set(0, 0.23, 0.3);
      rot(bk.book, -1.05 + 0.03 * Math.sin(t * 0.4), 0, 0.02 * Math.sin(t * 0.3));
      rot(bk.page, 0, -turn * 2.9, 0);
      h.group.updateMatrixWorld(true);
      bk.book.updateWorldMatrix(true, false);
      eL.set(-bk.W * 0.95, -bk.H * 0.18, -0.02).applyMatrix4(bk.book.matrixWorld);
      const lift = Math.sin(clamp((turnC - 11.1) / 2.0, 0, 1) * Math.PI);
      if (turnC > 11.2 && turnC < 13.1) { bk.page.updateWorldMatrix(true, false); eR.set(bk.W * 0.85, -bk.H * 0.25, 0.02).applyMatrix4(bk.page.matrixWorld); }
      else eR.set(bk.W * 0.95, -bk.H * 0.2, -0.02).applyMatrix4(bk.book.matrixWorld);
      eR.y += lift * 0.02;
      d.armIK('L', eL, d.W(0.45, 0.8, -0.3, pole));
      d.armIK('R', eR, d.W(-0.45, 0.8, -0.3, pole));
      rot(b.handL, -0.3, 0.9, -0.2); rot(b.handR, -0.3, -0.9, 0.2);
      tmp.set(0, 0, 0).applyMatrix4(bk.book.matrixWorld);
      d.lookAt(tmp, dt, { speed: 4, maxDown: 0.9 });
      // eyes lowered (reading)
      d.h.setFace(((t + 3.1) % 4.6) < 0.12 ? 'blink' : 'down');
    } });
  }

  // ============================================================ 6. café staff arranging the chalkboard
  {
    const spot = S.cafeStaff, board = S.cafeBoard;
    const h = person(ctx, {
      key: 'cafe', sex: 'f', height: 1.6, seed: 51, skin: SKIN.fair,
      face: faceF({ irisMid: '#6e5448', irisLight: '#b3927b', smile: 0.6, eyeH: 21 }),
      hair: { fringe: { n: 7, span: 60, tip: 10, skew: 18, w: 0.05, part: 5, partAt: 15 }, side: { w: 0.03, long: 0.02 }, ponytail: { len: 0.2, th: -8, w: 0.06, tie: '#8a6a58' }, hairlineBack: -50 },
      hairTex: HAIR.dark,
      outfit: { top: 'shirt', topColor: '#efece6', rolled: true, collar: '#efece6', tucked: true, bottom: 'trousers', bottomColor: '#6d6862', belt: '#5a4a44',
        apron: { color: '#6f7a61', strap: '#5f694f', hem: 0.42, pocket: '#65705a' }, shoes: { color: '#6a5046', sole: '#4f3e38' } },
      hands: { L: 'hold', R: 'hold' },
      props: [(hh) => gear.chalk(hh, 'R')],
    });
    const d = new Driver(ctx, h, { seed: 51 });
    // the A-frame (shopsA): group at the board spot, rotY = café lot frame + (PI/2 - 0.4), leaves 0.56 x 0.9,
    // feet 0.2 m in front of / behind the centre. Probe where the front leaf's top bar really is.
    const e1 = L.lotFrame(L.lotById('E1'));
    const bRot = e1.rotY + Math.PI / 2 - 0.4;
    const by = groundAt(ctx, board.x, board.z);
    const bc = Math.cos(bRot), bs = Math.sin(bRot);
    const BW = (lx, ly, lz, out = new THREE.Vector3()) => out.set(board.x + lx * bc + lz * bs, by + ly, board.z - lx * bs + lz * bc);
    const leafAng = Math.atan2(0.2, 0.9);
    let zTop = 0.2 + 0.9 * Math.sin(leafAng);                    // leaves splay outward at the top (as built today)
    if (!somethingAt(ctx, BW(0.0, 0.88, zTop), 0.04, 1.2) && somethingAt(ctx, BW(0.0, 0.88, 0.2 - 0.9 * Math.sin(leafAng)), 0.04, 1.2)) zTop = 0.2 - 0.9 * Math.sin(leafAng);
    const leafZ = (ly) => 0.2 + (zTop - 0.2) * clamp(ly / 0.9, 0, 1);
    // she stands at the board's front-right corner (a little closer than the nominal spot so she can reach it)
    const me = BW(0.37, 0, 0.6);
    const px = me.x, pz = me.z, y = groundAt(ctx, px, pz);
    const aim = BW(0.0, 0, 0.25);
    const rotY = Math.atan2(aim.x - px, aim.z - pz);
    collider(ctx, px, pz, y);
    const tL = new THREE.Vector3(), tR = new THREE.Vector3(), tW = new THREE.Vector3(), pole = new THREE.Vector3(), look = new THREE.Vector3();
    const restL = new THREE.Vector3(), restR = new THREE.Vector3();
    actors.push({ h, update(t, dt) {
      d.place(px, y, pz, rotY); d.reset();
      const c = t % 16;
      // 0-6 s: straightens the board (both hands on the top bar) · 6.5-9.5 s: steps back, hands on hips, checks it
      // 9.5-14.5 s: adds a line with the chalk (left hand steadies the frame)
      const back = smooth(6, 6.8, c) * (1 - smooth(9.2, 10, c));
      const write = smooth(9.6, 10.4, c) * (1 - smooth(14.2, 15, c));
      const hold = 1 - back;
      const bend = hold * (0.3 + 0.2 * write);
      const sh = Math.sin(t * 0.33);
      d.stand({ hz: -0.03 * bend - 0.04 * back, hx: 0.012 * sh, hrz: 0.015 * sh, hrx: 0.1 * bend, footL: [0.085, h.P.ankle, 0.06], footR: [-0.09, h.P.ankle, -0.07], toeL: 0.1, toeR: 0.25 });
      rotMul(h.b.spine, 0.3 * bend, -0.06 * write, 0); rotMul(h.b.chest, 0.22 * bend, -0.08 * write, 0);
      d.breathe(t);
      const nudge = 0.01 * Math.sin(t * 2.2) * (1 - write);
      BW(-0.02 + nudge, 0.925, leafZ(0.9) + 0.012, tL);
      BW(0.23 + nudge, 0.925, leafZ(0.9) + 0.012, tR);
      if (write > 0) {
        const wx = 0.045 * Math.sin(t * 6.1) + 0.02 * Math.sin(t * 13.7), wy = 0.02 * Math.sin(t * 3.3 + 1);
        const wyL = 0.77 + wy;
        BW(0.1 + wx, wyL, leafZ(wyL) + 0.06, tW);
        tR.lerp(tW, write);
      }
      // hands-on-hips wrist positions (elbows out) blend into the board targets
      d.W(0.185, h.P.waist - 0.02, -0.03, restL); d.W(-0.185, h.P.waist - 0.02, -0.03, restR);
      d.armIK('L', restL.lerp(tL, hold), d.W(lerp(0.75, 0.55, hold), 1.0, lerp(-0.6, -0.35, hold), pole));
      d.armIK('R', restR.lerp(tR, hold), d.W(lerp(-0.75, -0.55, hold), 1.0, lerp(-0.6, -0.35, hold), pole));
      rot(h.b.handL, -0.4 * hold, 0.3 * hold, 0.5 * back); rot(h.b.handR, -0.5 * hold, -0.4 * hold, -0.5 * back);
      BW(0.05, 0.7 + 0.1 * back, leafZ(0.7), look);
      d.lookAt(look, dt, { speed: 3, maxDown: 0.9, tilt: 0.12 * back });
      d.wind(t, dt);
      d.blink(t);
    } });
  }

  // ============================================================ 7. elderly lady with shopping bags walking the east sidewalk
  {
    const A = S.elderly.path[0], Bp = S.elderly.path[1];
    const h = person(ctx, {
      key: 'elder', sex: 'f', height: 1.47, width: 1.12, belly: 0.1, headK: 1.05, seed: 61, skin: SKIN.old,
      face: faceF({ skin: SKIN.old, closed: false, eyeW: 18, eyeH: 13, lidTop: -0.3, lash: 0.4, iris: 0.4, irisH: 0.55, irisMid: '#5e4d48', irisLight: '#8a766c', blush: 0.35, blushLines: false, wrinkles: true, smile: 0.7, brow: '#9a9097', browW: 1.8, browGap: 4 }),
      hair: { fringe: { n: 6, span: 62, tip: 18, skew: 26, w: 0.06, part: 8, partAt: 0, edgeDrop: 6 }, hairlineSide: -18, hairlineBack: -44, volume: 1.1, bun: { r: 0.042, th: 12, pin: '#8f6a5a' } },
      hairTex: HAIR.gray,
      outfit: { top: 'cardigan', topColor: '#b8a9c1', band: '#a797b1', shirt: '#ebe4d6', vAng: 26, vY: 0.85, jHemY: 0.7, bottom: 'trousers', bottomColor: '#77707f', shoes: { color: '#6a5a58', sole: '#51464a' } },
      hands: { L: 'hold', R: 'hold' },
      props: [(hh) => gear.glasses(hh, { color: '#9a8478' }),
        (hh) => gear.handBag(hh, 'R', { w: 0.34, h: 0.3, d: 0.13, color: '#c9bb96', handle: '#b3a47f', drop: 0.04, leek: true, greens: '#9dbb75' }),
        (hh) => gear.handBag(hh, 'L', { w: 0.2, h: 0.2, d: 0.1, color: '#c9a37a', band: '#e8dcc6', handle: '#9c7a58', drop: 0.03 })],
    });
    const d = new Driver(ctx, h, { seed: 61 });
    const len = Math.hypot(Bp.x - A.x, Bp.z - A.z), ux = (Bp.x - A.x) / len, uz = (Bp.z - A.z) / len;
    const v = 0.38, turnT = 2.6, restT = 1.2;
    const legT = len / v, period = 2 * (legT + turnT + restT);
    // detour around the utility pole on the east sidewalk (R1E z=23)
    const poleZ = L.POLE_RUNS.R1E.map(p => p).find(p => p.z > Math.min(A.z, Bp.z) && p.z < Math.max(A.z, Bp.z));
    const stride = 0.5, lift = 0.045;
    const state = { x: A.x, z: A.z, y: groundAt(ctx, A.x, A.z), yaw: 0 };
    const pathPos = (s) => {
      let x = A.x + ux * s, z = A.z + uz * s;
      if (poleZ) { const dz = z - poleZ.z; x += Math.exp(-(dz * dz) / 1.4) * Math.max(0, 0.55 - Math.abs(x - poleZ.x)); }
      return [x, z];
    };
    ctx.physics.addDynamic(() => [{ cx: state.x, cz: state.z, w: 0.46, d: 0.46, rotY: state.yaw, y0: state.y, y1: state.y + 1.5 }]);
    const fk = new THREE.Vector3();
    actors.push({ h, update(t, dt) {
      const c = t % period;
      // phases: walk A->B, rest, turn, walk B->A, rest, turn
      let s, dir, turning = 0, walking = 0, yaw;
      const headA = Math.atan2(ux, uz), headB = Math.atan2(-ux, -uz);
      if (c < legT) { s = c * v; dir = 1; walking = 1; yaw = headA; }
      else if (c < legT + restT) { s = len; dir = 1; yaw = headA; }
      else if (c < legT + restT + turnT) { s = len; turning = (c - legT - restT) / turnT; yaw = headA + Math.PI * smooth(0, 1, turning); }
      else if (c < 2 * legT + restT + turnT) { s = len - (c - legT - restT - turnT) * v; dir = -1; walking = 1; yaw = headB; }
      else if (c < 2 * legT + 2 * restT + turnT) { s = 0; yaw = headB; }
      else { s = 0; turning = (c - 2 * legT - 2 * restT - turnT) / turnT; yaw = headB + Math.PI * smooth(0, 1, turning); }
      const [x, z] = pathPos(s);
      const gy = ctx.physics.groundHeight(x, z, state.y + 0.2);
      state.x = x; state.z = z; state.y = gy; state.yaw = yaw;
      d.place(x, gy, z, yaw); d.reset();
      const P = h.P, b = h.b;
      // gait: distance travelled drives the feet
      const dist = walking ? (dir > 0 ? s : 2 * len - s) : 0;
      const ph = walking ? (dist / stride) : turning * 2;
      const bob = walking ? Math.abs(Math.sin(ph * Math.PI)) : 0;
      b.hips.position.y += -0.012 + 0.012 * bob;
      b.hips.position.x += 0.018 * Math.sin(ph * Math.PI) * (walking ? 1 : 0.3);
      rotMul(b.hips, 0.08, 0.05 * Math.sin(ph * Math.PI) * walking, 0.03 * Math.sin(ph * Math.PI) * walking);
      h.group.updateMatrixWorld(true);
      const foot = (n, off) => {
        const sgn = n === 'L' ? 1 : -1;
        let p = ((ph + off) % 2 + 2) % 2; // 0..2: 0..1.2 stance, 1.2..2 swing
        let zf, yf = P.ankle;
        if (!walking && !turning) zf = sgn * 0.02;
        else if (p < 1.2) zf = lerp(stride * 0.3, -stride * 0.3, p / 1.2);
        else { const q = (p - 1.2) / 0.8; zf = lerp(-stride * 0.3, stride * 0.3, smooth(0, 1, q)); yf += lift * Math.sin(q * Math.PI); }
        if (turning) zf *= 0.3;
        return [sgn * P.hipJx * 1.1, yf, zf];
      };
      d.leg('L', foot('L', 0), 0.18, [0.1, 1]); d.leg('R', foot('R', 1), -0.18, [0.1, 1]);
      rotMul(b.spine, 0.2, 0, 0); rotMul(b.chest, 0.16, -0.05 * Math.sin(ph * Math.PI) * walking, 0);
      d.breathe(t, 1.3);
      // arms hang with the bags, slight swing
      const sw = walking ? 0.1 * Math.sin(ph * Math.PI) : 0;
      d.arm('L', -0.15 + sw, 0.14, 0.1, 0.18, [0, 0, 0]);
      d.arm('R', -0.15 - sw, 0.16, -0.1, 0.18, [0, 0, 0]);
      d.lookYP(0.3 * wave(t * 0.2, 6) * (1 - walking * 0.5), -0.25 + 0.05 * bob, dt, { speed: 2 });
      // skirt follows the legs
      d.wind(t, dt);
      d.blink(t);
    } });
  }

  // ============================================================ 8. boy at the vending machine
  {
    const spot = S.vendingBoy;
    const y = groundAt(ctx, spot.x, spot.z);
    const h = person(ctx, {
      key: 'boy', sex: 'm', height: 1.5, width: 0.88, shoulder: 0.84, headK: 1.08, seed: 71, skin: SKIN.warm, ears: true,
      face: faceM({ eyeH: 17, eyeW: 19, irisMid: '#5a4a46', irisLight: '#937a6a', blush: 0.4, lidTop: -0.52 }),
      hair: { fringe: { n: 6, span: 58, tip: 10, skew: -10, w: 0.058, edgeDrop: 12 }, hairlineSide: -16, hairlineBack: -66, volume: 1.1, crown: [[170, 10, 25, 0.06], [-150, 5, -25, 0.06], [120, 0, 30, 0.05], [-110, 0, -25, 0.05]], ahoge: true },
      hairTex: HAIR.black,
      outfit: { top: 'hoodie', topColor: '#c9ccd0', band: '#b7bbc1', bottom: 'shorts', bottomColor: '#56627c', socks: { color: '#e9e6e0' },
        shoes: { color: '#e3e0da', sole: '#c9c3bb', accent: '#d0786a', type: 'sneaker' } },
      hands: { L: 'hold', R: 'point' },
      props: [(hh) => gear.backpack(hh, { color: '#6f8ea6', pocket: '#63809a', strap: '#56708a' })],
    });
    const d = new Driver(ctx, h, { seed: 71 });
    collider(ctx, spot.x, spot.z, y, 0.24, 1.5);
    const vm = L.VENDING.find(v => v.id === 'V1a');
    const face = vm.z + 0.375; // machine front (faces south)
    const tR = new THREE.Vector3(), pole = new THREE.Vector3(), look = new THREE.Vector3();
    const buttons = [[-0.22, 1.02], [0.02, 1.02], [0.12, 1.3], [-0.1, 1.3]];
    actors.push({ h, update(t, dt) {
      d.place(spot.x, y, spot.z, spot.rotY); d.reset();
      const c = t % 8.4, i = Math.floor(t / 2.1) % buttons.length, fr = (t % 2.1) / 2.1;
      const bt = buttons[i], nb = buttons[(i + 1) % buttons.length];
      const m = smooth(0.7, 1, fr);
      const bx = lerp(bt[0], nb[0], m), byy = lerp(bt[1], nb[1], m);
      const reach = 1 - smooth(6.2, 6.8, c) * (1 - smooth(7.7, 8.3, c));     // pulls the hand back to think
      const sh = Math.sin(t * 0.4);
      d.stand({ hx: 0.012 * sh, hrz: 0.02 * sh, hz: 0.02 * reach, footL: [0.08, h.P.ankle, 0.03], footR: [-0.09, h.P.ankle, -0.02] });
      rotMul(h.b.spine, 0.05 * reach, 0, 0);
      d.breathe(t);
      tR.set(vm.x - bx * Math.cos(0), y + byy, face + 0.07);
      const rest = d.W(-0.16, 0.95, 0.25, new THREE.Vector3());
      d.armIK('R', rest.lerp(tR, reach), d.W(-0.45, 0.8, -0.2, pole));
      rot(h.b.handR, -0.2, 0, 0);
      // left hand: coins at the chest / scratching the head while deciding
      const think = 1 - reach;
      d.arm('L', 0.45 + 1.9 * think, 0.12 + 0.3 * think, -0.45 + 0.85 * think, 1.8 + 0.3 * think, [0.3, 0, 0]);
      look.set(vm.x - bx * 0.6, y + 1.35 - 0.1 * think, vm.z);
      d.lookAt(look, dt, { speed: 3, tilt: 0.12 * think });
      d.blink(t);
    } });
  }

  // ============================================================ 9. three students chatting by the tree bench
  {
    const c0 = S.plazaStudents;
    const ppl = [
      { dx: -0.45, dz: 0.3 }, { dx: 0.45, dz: 0.38 }, { dx: 0.02, dz: -0.5 },
    ];
    const cx = c0.x + (ppl[0].dx + ppl[1].dx + ppl[2].dx) / 3, cz = c0.z + (ppl[0].dz + ppl[1].dz + ppl[2].dz) / 3;
    const specs = [
      { key: 'stuA', sex: 'f', height: 1.55, seed: 81, skin: SKIN.fair, variants: ['open', 'blink', 'talk', 'laugh'],
        face: faceF({ irisMid: '#6a5250', irisLight: '#b49488', eyeH: 23 }),
        hair: { fringe: { n: 7, span: 60, tip: 2, skew: 5, w: 0.05 }, side: { long: 0.1, w: 0.032 }, back: { len: 0.3, n: 7, span: 108, w: 0.075, spread: 0.2 }, hairlineBack: -62,
          accessory: (hh) => gear.hairClip(hh, 44, 36, '#f0c46a') },
        hairTex: HAIR.dark, stripes: STRIPES,
        outfit: { top: 'sailor', topColor: '#eeebe6', scarf: '#c9707c', bottom: 'pleats', bottomColor: '#4b5576', hem: 0.54, pleats: 18, socks: { color: '#454d6a', top: 0.78 }, shoes: { color: '#5b4336', sole: '#4a3a36' } },
        hands: { L: 'relax', R: 'hold' },
        props: [(hh) => gear.handBag(hh, 'R', { w: 0.36, h: 0.26, d: 0.09, color: '#5b5062', handle: '#4e4555', drop: 0.0, yaw: 0 })] },
      { key: 'stuB', sex: 'f', height: 1.59, seed: 82, skin: SKIN.warm, variants: ['open', 'blink', 'talk', 'laugh'],
        face: faceF({ irisMid: '#5d6480', irisLight: '#a3abc6', eyeH: 21, smile: 0.5 }),
        hair: { fringe: { n: 7, span: 60, tip: 4, skew: -8, w: 0.052 }, hairlineSide: -62, hairlineBack: -72, flare: 0.16, side: { w: 0.036 } },
        hairTex: HAIR.soft, plaid: PLAID,
        outfit: { top: 'blazer', topColor: '#5a6380', lapel: '#535c78', shirt: '#eeebe6', ribbon: '#b85f6c', buttons: '#c9b27a', emblem: '#c9b27a', vAng: 30, vY: 0.95, jHemY: 0.8,
          bottom: 'pleats', plaid: true, bottomColor: '#6c7690', hem: 0.53, pleats: 16, socks: { color: '#454d6a', top: 0.78 }, shoes: { color: '#5b4336', sole: '#4a3a36' } },
        hands: { L: 'relax', R: 'relax' },
        props: [(hh) => gear.shoulderBag(hh, { color: '#6a6f86', flap: '#61667c' })] },
      { key: 'stuC', sex: 'm', height: 1.7, seed: 83, skin: SKIN.fair, ears: true, variants: ['open', 'blink', 'talk', 'laugh'],
        face: faceM({ irisMid: '#4f4a5e', irisLight: '#86809a', eyeH: 15 }),
        hair: { fringe: { n: 6, span: 58, tip: 5, skew: 12, w: 0.06, edgeDrop: 14 }, hairlineSide: -20, hairlineBack: -68, volume: 1.11, crown: [[160, 5, 25, 0.065], [-160, 0, -25, 0.065], [110, -5, 30, 0.05], [-115, -5, -30, 0.05]], ahoge: true, side: { w: 0.026 } },
        hairTex: HAIR.blue,
        outfit: { top: 'blazer', topColor: '#5a6380', lapel: '#535c78', shirt: '#eeebe6', tie: '#8a5260', buttons: '#c9b27a', emblem: '#c9b27a', vAng: 30, vY: 0.75, bottom: 'trousers', bottomColor: '#555c70', belt: '#3f3a40',
          shoes: { color: '#4f4444', sole: '#3f3838' } },
        hands: { L: 'fist', R: 'relax' } },
    ];
    const tmp = new THREE.Vector3();
    const hs = specs.map((sp, i) => {
      const x = c0.x + ppl[i].dx, z = c0.z + ppl[i].dz, y = groundAt(ctx, x, z);
      const h = person(ctx, sp);
      const d = new Driver(ctx, h, { seed: sp.seed, hairAmp: 1.1 });
      collider(ctx, x, z, y);
      return { h, d, x, y, z, rotY: Math.atan2(cx - x, cz - z) };
    });
    const heads = hs.map(o => new THREE.Vector3(o.x, o.y + 1.45, o.z));
    // conversation script (period 12 s): speaker index per slot, laugh moments
    const slots = [0, 0, 1, 1, 2, 0, 1, 2, 2, 1, 0, 1];
    actors.push({ h: hs[0].h, update(t, dt) {
      const slot = Math.floor(t % 12), speaker = slots[slot];
      const laugh = smooth(7.6, 7.9, t % 12) * (1 - smooth(9.0, 9.6, t % 12));
      hs.forEach((o, i) => {
        const { h, d } = o;
        const talking = speaker === i && laugh < 0.5;
        d.place(o.x, o.y, o.z, o.rotY + (i === 2 ? -0.1 : 0.05)); d.reset();
        const sh = Math.sin(t * (0.3 + i * 0.05) + i * 2);
        d.stand({ hx: 0.02 * sh, hrz: 0.022 * sh, hry: 0.04 * sh, footL: [0.07 + 0.01 * i, h.P.ankle, 0.02 * (i - 1)], footR: [-0.08, h.P.ankle, -0.02 * (i - 1)] });
        d.breathe(t + i);
        rotMul(h.b.spine, -0.06 * laugh + 0.04 * (talking ? 1 : 0), 0, 0);
        const g = talking ? Math.sin(t * 3.1 + i) : 0;
        if (i === 0) { // sailor girl: bag in both hands in front, one hand gestures while talking
          d.arm('R', 0.18, 0.05, -0.1, 0.5, [0, 0, 0]);
          d.arm('L', 0.25 + (talking ? 0.35 + 0.15 * g : 0) + laugh * 0.6, 0.02, -0.4, 0.9 + (talking ? 0.6 : 0) + laugh * 1.0, [0, 0, 0]);
        } else if (i === 1) { // blazer girl: animated gestures, hand to mouth when laughing
          d.arm('L', 0.1, 0.12, 0, 0.3, [0, 0, 0]);
          d.arm('R', 0.2 + (talking ? 0.45 + 0.2 * g : 0) + laugh * 0.95, 0.12, 0.3 - laugh * 0.7, 0.6 + (talking ? 0.7 + 0.3 * g : 0) + laugh * 1.5, [0.2, 0, 0]);
        } else { // blazer boy: hand in pocket, other hand scratches his head when laughing
          d.arm('L', -0.05, 0.22, 0.2, 0.75, [0, 0, 0]);
          d.arm('R', 0.15 + (talking ? 0.3 + 0.2 * g : 0) + laugh * 2.4, 0.2 + laugh * 0.5, 0, 0.5 + (talking ? 0.5 : 0) + laugh * 1.4, [0, 0, 0]);
        }
        // look at the speaker (or at a friend when speaking)
        const tgt = speaker === i ? heads[(i + 1 + (Math.floor(t / 3) % 2)) % 3] : heads[speaker];
        tmp.copy(tgt);
        d.lookAt(tmp, dt, { speed: 3, tilt: (talking ? 0.06 * Math.sin(t * 1.3) : 0.04) - laugh * 0.08 });
        rotMul(h.b.head, -0.12 * laugh, 0, 0);
        d.wind(t, dt);
        const bl = ((t + i * 1.9) % (3.1 + i * 0.7)) < 0.12;
        h.setFace(laugh > 0.5 ? 'laugh' : bl ? 'blink' : (talking && Math.sin(t * 11 + i) > -0.2 ? 'talk' : 'open'));
      });
    } });
  }

  // ============================================================ 10. girl under the big tree, hair & skirt in the breeze
  {
    const spot = S.treeGirl;
    const y = groundAt(ctx, spot.x, spot.z);
    const tree = (ctx.services.sakura?.trees || []).reduce((best, tr) => { const dd = Math.hypot(tr.x - L.PLAZA.tree.x, tr.z - L.PLAZA.tree.z); return dd < 3 && (!best || dd < best.dd) ? { ...tr, dd } : best; }, null);
    const canopy = tree ? new THREE.Vector3(tree.x, tree.y, tree.z) : new THREE.Vector3(L.PLAZA.tree.x, 6.0, L.PLAZA.tree.z);
    const h = person(ctx, {
      key: 'treeGirl', sex: 'f', height: 1.58, seed: 91, skin: SKIN.fair,
      face: faceF({ irisDark: '#4a3a4e', irisMid: '#7b6272', irisLight: '#c7a7ae', eyeH: 23, smile: 0.35 }),
      hair: { fringe: { n: 7, span: 62, tip: 0, skew: -6, w: 0.05 }, side: { long: 0.16, w: 0.033 }, back: { len: 0.5, n: 7, span: 108, w: 0.09, spread: 0.2, taper: 0.2 }, hairlineBack: -64 },
      hairTex: HAIR.chestnut,
      outfit: { top: 'blouse', topColor: '#f1ece2', collar: '#f1ece2', tucked: true, bottom: 'skirt', bottomColor: '#a9bdd3', hem: 0.3, flare: 0.16, legs: '#f2d8c7', shoes: { color: '#8b6a5c', sole: '#6a5248' } },
      hands: { L: 'relax', R: 'relax' },
      props: [(hh) => gear.shoulderBag(hh, { color: '#d9c7a6', flap: '#cdb996', strap: '#b89f7c' })],
    });
    const d = new Driver(ctx, h, { seed: 91, hairAmp: 1.15, skirtAmp: 1.5, wind: 1.2 });
    collider(ctx, spot.x, spot.z, y);
    actors.push({ h, update(t, dt) {
      d.place(spot.x, y, spot.z, spot.rotY); d.reset();
      const gust = ctx.shared.uGust.value;
      const sh = Math.sin(t * 0.25);
      d.stand({ hx: 0.015 * sh, hrz: 0.02 * sh, footL: [0.075, h.P.ankle, 0.04], footR: [-0.08, h.P.ankle, -0.03], toeL: 0.2 });
      rotMul(h.b.spine, -0.06, 0, 0); rotMul(h.b.chest, -0.08, 0, 0);
      d.breathe(t);
      // holds her hair back when the gust is strong
      const hold = smooth(0.5, 0.68, gust);
      d.arm('L', 0.05, 0.1, 0, 0.2, [0, 0, 0]);
      d.lookAt(canopy, dt, { speed: 1.2, maxUp: 0.75, tilt: 0.1 * Math.sin(t * 0.21) });
      d.arm('R', 0.05, 0.08, 0, 0.12, [0, 0, 0]);
      if (hold > 0.001) {
        // hand holding the hair back beside the right ear
        const hd = h.P.head; h.b.head.updateWorldMatrix(true, false);
        const ear = new THREE.Vector3(-hd.rx * 1.25, hd.cy - hd.ry * 0.15, hd.cz - hd.rz * 0.25).applyMatrix4(h.b.head.matrixWorld);
        const rest = d.W(-0.19, 0.78, 0.03, new THREE.Vector3());
        d.armIK('R', rest.lerp(ear, hold), d.W(-0.6, 1.1, -0.2, new THREE.Vector3()));
        rot(h.b.handR, -0.3 * hold, 0, -0.9 * hold);
      }
      d.wind(t, dt, { boost: 1.0 });
      d.blink(t);
    } });
  }

  return actors;
}

// ------------------------------------------------------------------ uniformed station staff
function staffSpec(key, height, seed, hairTex, o = {}) {
  return {
    key, sex: 'm', height, seed, skin: SKIN.warm, ears: true,
    face: faceM({ irisMid: '#5a4c48', irisLight: '#8a766a', eyeH: 14, lidTop: -0.45 }),
    hair: { fringe: { n: 5, span: 52, tip: 14, skew: 10, w: 0.05, edgeDrop: 6 }, hairlineSide: -14, hairlineBack: -62, volume: 1.035 },
    hairTex,
    outfit: { top: 'staff', topColor: UNIFORM.navy, lapel: UNIFORM.navyDark, shirt: UNIFORM.shirt, tie: '#39425c', buttons: '#d3b268', vAng: 26, vY: 0.8, emblem: '#e39bb5', nameTag: '#efece6',
      bottom: 'trousers', bottomColor: UNIFORM.navyDark, belt: '#353046', gloves: '#eceae6', shoes: { color: '#443c42', sole: '#39333a' } },
    hands: { L: 'relax', R: o.point ? 'point' : 'relax' },
    props: [(hh) => gear.staffCap(hh, { color: '#3e4968', band: '#343d58', visor: '#2f3548' })],
  };
}
