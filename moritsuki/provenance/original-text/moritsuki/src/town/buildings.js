// 建物: OSM の輪郭 + 空いた街区に自動で並べる家。窓や瓦はシェーダーで描く
import * as THREE from 'three';
import { Mesher } from './mesher.js';
import { obb, polyArea, rng, hash2, pointInPoly } from './data.js';
import { M } from './layout.js';
import { lambert } from './materials.js';

const C = (h) => new THREE.Color(h);
export const PAL = {
  houseWall: ['#f2efe7', '#ece4d2', '#e2dccf', '#d9d4c8', '#efe9dc', '#cfc4b0', '#e8e0c8', '#f5f3ee', '#d8cdb6', '#e9e6df', '#c7bfb0'].map(C),
  oldWall: ['#9a7e5f', '#8a7056', '#b09a7a'].map(C),
  sideWall: ['#7c8a96', '#8f9aa0', '#a9a39a'].map(C),
  kawara: ['#4c5563', '#56606e', '#3f4753', '#5b5f66', '#475060'].map(C),
  metal: ['#8a3a2e', '#3f6b58', '#35506e', '#6b6f73', '#7a4a3a', '#2f5a6e'].map(C),
  aptWall: ['#f0eee8', '#e9e4da', '#e4e2de', '#efe6d6'].map(C),
  instWall: ['#f1f1ee', '#e8e6e0', '#eae7de'].map(C),
  whWall: ['#c9ccce', '#b7bec4', '#d3d0c6', '#aeb5b9'].map(C),
  whRoof: ['#9aa3aa', '#8f969b', '#7f8f99', '#a3a39c'].map(C),
  flatRoof: ['#a9a69e', '#b4b1a8', '#9d9a92'].map(C),
};
export const STYLE = { house: 0, apt: 1, inst: 2, warehouse: 3, shop: 4, wood: 5 };

export class Buildings {
  constructor(ctx) {
    this.ctx = ctx;
    this.walls = new Mesher({ aWall: 3, aB: 4 });
    this.roofs = new Mesher({ aRoof: 3 });
    this.trim = new Mesher();
    this.gardenTrees = [];
    this.count = 0;
  }

  // desc: { cx, cz, ux, uz, w, d, floors, floorH, roof, style, wall, roofCol, roofKind, seed, poly }
  add(desc) {
    const { ground, segs, mask } = this.ctx;
    const d = { floorH: 2.8, roof: 'gable', pitch: 0.5, overhang: 0.55, roofKind: 0, ...desc };
    (this.list ||= []).push(d);
    const { cx, cz, ux, uz, w } = d, dd = d.d;
    const vx = -uz, vz = ux;
    const L = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
    const corners = d.poly || [L(-w / 2, -dd / 2), L(-w / 2, dd / 2), L(w / 2, dd / 2), L(w / 2, -dd / 2)];
    let gmin = Infinity, gmax = -Infinity;
    for (const [x, z] of corners) { const g = ground(x, z); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); }
    const g0 = ground(cx, cz);
    gmin = Math.min(gmin, g0); gmax = Math.max(gmax, g0);
    const base = (d.base ?? gmax) + 0.35;
    const top = d.floors * d.floorH;
    const yTop = base + top;
    const B = [d.seed, d.floorH, d.style, top];
    // 外壁
    const poly = corners.slice();
    const cxp = poly.reduce((s, p) => s + p[0], 0) / poly.length, czp = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    {
      const [a, b] = poly;
      const ex = b[0] - a[0], ez = b[1] - a[1];
      const nx = -ez, nz = ex, mx = (a[0] + b[0]) / 2 - cxp, mz = (a[1] + b[1]) / 2 - czp;
      if (nx * mx + nz * mz < 0) poly.reverse();
    }
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      const y0 = gmin - 0.4 - base;
      this.walls.face([[a[0], base + y0, a[1]], [b[0], base + y0, b[1]], [b[0], yTop, b[1]], [a[0], yTop, a[1]]], d.wall,
        [{ aWall: [0, y0, len], aB: B }, { aWall: [len, y0, len], aB: B }, { aWall: [len, top, len], aB: B }, { aWall: [0, top, len], aB: B }]);
    }
    segs.addPoly(corners, yTop);
    mask.fillPoly(corners, M.BLD);
    this.count++;

    // 屋根
    if (d.poly || d.roof === 'flat') {
      this.flatRoof(poly, yTop, d);
      return { base, yTop };
    }
    const o = d.overhang, W = w / 2 + o, D = dd / 2 + o, p = d.pitch;
    const yE = yTop - o * p, yR = yTop + (dd / 2) * p;
    const P = (a, b, y) => { const [x, z] = L(a, b); return [x, y, z]; };
    const slopeLen = Math.hypot(D, yR - yE);
    const R = (u, v) => ({ aRoof: [u, v, d.roofKind] });
    const rc = d.roofCol;
    const yawU = Math.atan2(-uz, ux);
    const gutter = C('#6b6e70'), fascia = d.fascia || C('#ecebe6');
    const eaveLong = (y) => {
      for (const sb of [1, -1]) {
        const [fx, fz] = L(0, sb * D);
        this.trim.box(fx, y - 0.07, fz, 2 * W + 0.04, 0.2, 0.06, yawU, fascia);
        const [gx, gz] = L(0, sb * (D + 0.07));
        this.trim.box(gx, y - 0.15, gz, 2 * W, 0.1, 0.12, yawU, gutter);
      }
    };
    const downpipes = (y) => {
      for (const [sa, sb] of [[1, 1], [-1, -1]]) {
        const [px, pz] = L(sa * (w / 2 + 0.06), sb * (dd / 2 + 0.06));
        this.trim.box(px, (gmin + y) / 2, pz, 0.08, y - gmin, 0.08, yawU, gutter);
      }
    };
    if (d.roof === 'shed') {
      // 片流れ（後ろが高い）
      const yLo = yTop - o * p, yHi = yTop + (dd + o) * p, yW = yTop + dd * p;
      this.roofs.face([P(-W, D, yLo), P(W, D, yLo), P(W, -D, yHi), P(-W, -D, yHi)], rc, [R(-W, 0), R(W, 0), R(W, Math.hypot(2 * D, yHi - yLo)), R(-W, Math.hypot(2 * D, yHi - yLo))]);
      const gB = (u) => ({ aWall: [u, top + 0.5, dd], aB: B });
      this.walls.face([P(w / 2, dd / 2, yTop), P(w / 2, -dd / 2, yTop), P(w / 2, -dd / 2, yW)], d.wall, [gB(0), gB(dd), gB(dd)]);
      this.walls.face([P(-w / 2, -dd / 2, yTop), P(-w / 2, dd / 2, yTop), P(-w / 2, -dd / 2, yW)], d.wall, [gB(0), gB(dd), gB(0)]);
      this.walls.face([P(w / 2, -dd / 2, yTop), P(-w / 2, -dd / 2, yTop), P(-w / 2, -dd / 2, yW), P(w / 2, -dd / 2, yW)], d.wall, [gB(0), gB(w), gB(w), gB(0)]);
      const [fx, fz] = L(0, D);
      this.trim.box(fx, yLo - 0.07, fz, 2 * W, 0.2, 0.06, yawU, fascia);
      downpipes(yLo);
      return { base, yTop };
    }
    if (d.roof === 'gable') {
      this.roofs.face([P(W, -D, yE), P(-W, -D, yE), P(-W, 0, yR), P(W, 0, yR)], rc, [R(W, 0), R(-W, 0), R(-W, slopeLen), R(W, slopeLen)]);
      this.roofs.face([P(-W, D, yE), P(W, D, yE), P(W, 0, yR), P(-W, 0, yR)], rc, [R(-W, 0), R(W, 0), R(W, slopeLen), R(-W, slopeLen)]);
      // 妻壁
      const yr = yTop + (dd / 2) * p;
      const gB = (u) => ({ aWall: [u, top + 0.5, dd], aB: B });
      this.walls.face([P(w / 2, dd / 2, yTop), P(w / 2, -dd / 2, yTop), P(w / 2, 0, yr)], d.wall, [gB(0), gB(dd), gB(dd / 2)]);
      this.walls.face([P(-w / 2, -dd / 2, yTop), P(-w / 2, dd / 2, yTop), P(-w / 2, 0, yr)], d.wall, [gB(0), gB(dd), gB(dd / 2)]);
      // 破風（屋根の端の板）
      for (const s of [1, -1]) {
        this.trim.face([P(s * W, -D, yE - 0.18), P(s * W, 0, yR - 0.18), P(s * W, 0, yR + 0.02), P(s * W, -D, yE + 0.02)].map((q, i, arr) => (s > 0 ? q : arr[[1, 0, 3, 2][i]])), C('#e9e6df'));
        this.trim.face([P(s * W, 0, yR - 0.18), P(s * W, D, yE - 0.18), P(s * W, D, yE + 0.02), P(s * W, 0, yR + 0.02)].map((q, i, arr) => (s > 0 ? q : arr[[1, 0, 3, 2][i]])), C('#e9e6df'));
      }
      if (d.roofKind === 0) this.ridge(P(-W, 0, yR), P(W, 0, yR), rc);
      eaveLong(yE);
      downpipes(yE);
      if (d.solar) this.solar(P, W * 0.72, D, yR, p, uz, ux);
    } else {
      // 寄棟
      const Rr = Math.max(0, (w - dd) / 2);
      this.roofs.face([P(W, -D, yE), P(-W, -D, yE), P(-Rr, 0, yR), P(Rr, 0, yR)], rc, [R(W, 0), R(-W, 0), R(-Rr, slopeLen), R(Rr, slopeLen)]);
      this.roofs.face([P(-W, D, yE), P(W, D, yE), P(Rr, 0, yR), P(-Rr, 0, yR)], rc, [R(-W, 0), R(W, 0), R(Rr, slopeLen), R(-Rr, slopeLen)]);
      const endLen = Math.hypot(W - Rr, yR - yE);
      this.roofs.face([P(W, D, yE), P(W, -D, yE), P(Rr, 0, yR)], rc, [R(D, 0), R(-D, 0), R(0, endLen)]);
      this.roofs.face([P(-W, -D, yE), P(-W, D, yE), P(-Rr, 0, yR)], rc, [R(-D, 0), R(D, 0), R(0, endLen)]);
      if (d.roofKind === 0 && Rr > 0.2) this.ridge(P(-Rr, 0, yR), P(Rr, 0, yR), rc);
      eaveLong(yE);
      for (const sa of [1, -1]) {
        const [fx, fz] = L(sa * W, 0);
        this.trim.box(fx, yE - 0.07, fz, 0.06, 0.2, 2 * D + 0.04, yawU, fascia);
      }
      downpipes(yE);
      if (d.solar && Rr > 1.5) this.solar(P, Rr + 0.3, D, yR, p, uz, ux);
    }
    return { base, yTop };
  }

  // 南向きの屋根面に太陽光パネル
  solar(P, halfA, D, yR, p, uz, ux) {
    const sb = -uz * 0 + ux > 0 ? 1 : -1; // v = (-uz, ux) の z 成分が正なら +v 側が南
    const b0 = D * 0.18, b1 = D * 0.82, lift = 0.09;
    const Y = (b) => yR - b * p + lift;
    const q = [P(-halfA, sb * b1, Y(b1)), P(halfA, sb * b1, Y(b1)), P(halfA, sb * b0, Y(b0)), P(-halfA, sb * b0, Y(b0))];
    const pts = sb > 0 ? q : [q[1], q[0], q[3], q[2]];
    const len = Math.hypot(b1 - b0, (b1 - b0) * p);
    this.roofs.face(pts, C('#1d2a52'), [{ aRoof: [0, 0, 3] }, { aRoof: [halfA * 2, 0, 3] }, { aRoof: [halfA * 2, len, 3] }, { aRoof: [0, len, 3] }]);
  }

  ridge(a, b, rc) {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    this.trim.box((a[0] + b[0]) / 2, a[1] + 0.06, (a[2] + b[2]) / 2, 0.34, 0.22, len, yaw, rc.clone().multiplyScalar(0.8));
  }

  flatRoof(poly, y, d) {
    const shape = poly.map(([x, z]) => new THREE.Vector2(x, z));
    const tris = THREE.ShapeUtils.triangulateShape(shape, []);
    const rc = d.roofCol;
    const base = this.roofs.count;
    for (const [x, z] of poly) this.roofs.v(x, y, z, 0, 1, 0, rc, { aRoof: [x, z, 2] });
    for (const [a, b, c] of tris) {
      // 上向きになるように
      const [ax, az] = poly[a], [bx, bz] = poly[b], [cx, cz] = poly[c];
      const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (up > 0) this.roofs.tri(base + a, base + b, base + c); else this.roofs.tri(base + a, base + c, base + b);
    }
    // パラペット
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.1) continue;
      this.trim.box((a[0] + b[0]) / 2, y + 0.3, (a[1] + b[1]) / 2, 0.25, 0.6, len + 0.2, Math.atan2(b[0] - a[0], b[1] - a[1]), d.wall.clone().multiplyScalar(0.94));
    }
  }

  // ---------- OSM の建物 ----------
  fromOSM(V) {
    const { mask } = this.ctx;
    for (const b0 of V.buildings) {
      const k = 1.4;
      const [mx, mz] = b0.p.reduce((a, q) => [a[0] + q[0] / b0.p.length, a[1] + q[1] / b0.p.length], [0, 0]);
      const b = { ...b0, p: b0.p.map(([x, z]) => [mx + (x - mx) * k, mz + (z - mz) * k]) };
      const realArea = Math.abs(polyArea(b0.p)) * 4;
      const big = realArea > 380 || ['school', 'university', 'public', 'civic', 'townhall', 'warehouse', 'industrial', 'train_station', 'commercial', 'retail'].includes(b.b) || b.a === 'place_of_worship';
      if (!big) continue;
      const box = obb(b.p);
      if (!box || mask.anyInRect(box.cx, box.cz, box.ux, box.uz, box.w, box.d, M.ROAD | M.BLD | M.KEEP | M.WATER | M.RAIL)) continue;
      if (!box || box.w < 1.5 || box.d < 1.2) continue;
      const area = Math.abs(polyArea(b.p));
      const fill = area / (box.w * box.d);
      const r = rng(Math.floor(hash2(box.cx * 3.1, box.cz * 1.7) * 1e9) + 7);
      const inHarbor = this.ctx.mask.get(box.cx, box.cz) & M.HARBOR;
      const desc = { cx: box.cx, cz: box.cz, ux: box.ux, uz: box.uz, w: box.w, d: box.d, seed: r() };
      const lv = b.lv;
      if (b.a === 'place_of_worship') {
        Object.assign(desc, { style: STYLE.wood, floors: 1, floorH: 3.6, roof: 'hip', pitch: 0.7, overhang: 0.9, wall: PAL.oldWall[0], roofCol: C('#3f4650'), roofKind: 0 });
      } else if (['warehouse', 'industrial', 'garage', 'shed', 'roof', 'garages', 'storage_tank'].includes(b.b) || (inHarbor && area > 60)) {
        Object.assign(desc, { style: STYLE.warehouse, floors: 1, floorH: area > 300 ? 6 : 3.5, roof: 'gable', pitch: 0.18, overhang: 0.3, wall: pick(PAL.whWall, r), roofCol: pick(PAL.whRoof, r), roofKind: 1 });
      } else if (b.b === 'apartments' || (area > 170 && area < 700 && r() < 0.5)) {
        Object.assign(desc, { style: STYLE.apt, floors: lv || 2 + Math.floor(r() * 2), floorH: 2.9, roof: r() < 0.6 ? 'flat' : 'hip', pitch: 0.3, wall: pick(PAL.aptWall, r), roofCol: r() < 0.5 ? pick(PAL.flatRoof, r) : pick(PAL.kawara, r), roofKind: 0 });
      } else if (area >= 450 || ['school', 'university', 'public', 'civic', 'townhall', 'hospital', 'commercial', 'retail', 'kindergarten', 'train_station'].includes(b.b)) {
        Object.assign(desc, { style: STYLE.inst, floors: lv || (area > 900 ? 3 : 2), floorH: 3.4, roof: 'flat', wall: pick(PAL.instWall, r), roofCol: pick(PAL.flatRoof, r) });
      } else {
        this.houseStyle(desc, r, lv);
      }
      if (fill < 0.72 || b.p.length > 9) desc.poly = b.p.slice(0, -1).length >= 3 ? dedupe(b.p) : null;
      if (desc.poly && desc.poly.length < 3) desc.poly = null;
      this.add(desc);
    }
  }

  houseStyle(desc, r, lv) {
    const old = r() < 0.12, metal = r() < 0.3;
    Object.assign(desc, {
      style: STYLE.house, floors: lv || (r() < 0.78 ? 2 : 1), floorH: 2.8,
      roof: r() < 0.55 ? 'gable' : 'hip', pitch: 0.42 + r() * 0.2, overhang: 0.45 + r() * 0.25,
      wall: old ? pick(PAL.oldWall, r) : r() < 0.1 ? pick(PAL.sideWall, r) : pick(PAL.houseWall, r),
      roofCol: metal ? pick(PAL.metal, r) : pick(PAL.kawara, r), roofKind: metal ? 1 : 0,
    });
    return desc;
  }

  meshes() {
    const wallMat = lambert({}, {
      amp: 0.07, scale: 0.5, key: 'wall',
      attrs: 'attribute vec3 aWall; attribute vec4 aB;', vars: 'varying vec3 vWall; varying vec4 vB;',
      vtx: 'vWall = aWall; vB = aB;',
      frag: WALL_GLSL,
    });
    const roofMat = lambert({ side: THREE.DoubleSide }, {
      amp: 0.1, scale: 0.35, key: 'roof',
      attrs: 'attribute vec3 aRoof;', vars: 'varying vec3 vRoof;', vtx: 'vRoof = aRoof;',
      frag: /* glsl */ `
        {
          float kind = vRoof.z;
          if (kind < 0.5) {
            float row = fract(vRoof.y / 0.28);
            diffuseColor.rgb *= 0.84 + 0.16 * smoothstep(0.0, 0.3, row);
            diffuseColor.rgb *= 0.96 + 0.07 * step(0.5, fract(vRoof.x / 0.3 + floor(vRoof.y / 0.28) * 0.5));
          } else if (kind < 1.5) {
            float rib = abs(fract(vRoof.x / 0.45) - 0.5);
            diffuseColor.rgb *= 0.88 + 0.12 * smoothstep(0.02, 0.08, rib);
          } else if (kind < 2.5) {
            diffuseColor.rgb *= 0.9 + tnV(vRoof.xy * 0.8) * 0.12;
          } else {
            vec2 cell = fract(vRoof.xy / vec2(1.0, 1.65));
            float line = step(0.93, max(cell.x, cell.y));
            diffuseColor.rgb = mix(vec3(0.07, 0.1, 0.24), vec3(0.72, 0.74, 0.78), line * 0.7);
          }
          if (!gl_FrontFacing) diffuseColor.rgb *= 0.55;
        }`,
    });
    const trimMat = lambert({ side: THREE.DoubleSide }, { amp: 0.08, scale: 0.6, key: 'trim' });
    const out = [];
    for (const [m, mat] of [[this.walls, wallMat], [this.roofs, roofMat], [this.trim, trimMat]]) {
      if (!m.count) continue;
      const mesh = new THREE.Mesh(m.build(), mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  }
}

export const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
function dedupe(p) {
  const out = [];
  for (const q of p) { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.2) out.push(q); }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.2) out.pop();
  return out;
}

// 窓・扉・ベランダ・土台
export const WALL_GLSL = /* glsl */ `
{
  float u = vWall.x, v = vWall.y, len = vWall.z;
  float seed = vB.x, fh = vB.y, style = vB.z, top = vB.w;
  vec3 wall = diffuseColor.rgb;
  vec3 col = wall;
  vec3 glassA = vec3(0.16, 0.22, 0.28), glassB = vec3(0.52, 0.64, 0.74);
  if (v < 0.3) {
    col = vec3(0.6, 0.58, 0.54);
  } else if (v < top - 0.02) {
    float fl = floor(v / fh), fv = v - fl * fh;
    // ハッシュの入力は整数に丸める（補間のわずかなぶれで窓がちらつかないように）
    float sdI = floor(seed * 997.0 + 0.5);
    float wallId = floor(len * 7.0 + 0.5) + sdI;
    if (style < 0.5 || style > 4.5 || (style > 3.5 && fl > 0.5)) {
      // 家: 横の板張り
      if (fract(seed * 7.3) > 0.45 && style < 0.5) col *= 0.965 + 0.035 * step(0.5, fract(v / 0.2));
      float slot = 3.3, n = max(floor((len - 0.8) / slot), 0.0), w0 = (len - n * slot) * 0.5;
      float su = u - w0, si = floor(su / slot), fu = su - si * slot;
      float h = tnH(vec2(si + wallId, fl * 7.0 + mod(sdI, 89.0)));
      if (su > 0.0 && si < n && h > 0.3) {
        float ground0 = fl < 0.5 ? 1.0 : 0.0;
        bool door = ground0 > 0.5 && h > 0.85;
        vec2 c = vec2(slot * 0.5, door ? 1.05 : (ground0 > 0.5 && h > 0.6 ? 1.2 : 1.45));
        vec2 hs = door ? vec2(0.5, 1.02) : (ground0 > 0.5 && h > 0.6 ? vec2(0.9, 0.9) : vec2(0.8, 0.58));
        vec2 dq = abs(vec2(fu, fv) - c);
        if (dq.x < hs.x && dq.y < hs.y) {
          float frame = step(hs.x - 0.07, dq.x) + step(hs.y - 0.07, dq.y);
          vec3 g = door ? vec3(0.45, 0.36, 0.28) : mix(glassA, glassB, smoothstep(-hs.y, hs.y, fv - c.y) * 0.8);
          if (!door && tnH(vec2(si * 3.0 + wallId, fl + 1.0)) > 0.65) g = mix(g, vec3(0.86, 0.8, 0.66), 0.55);
          if (!door && abs(fu - c.x) < 0.03) frame = 1.0;
          col = frame > 0.0 ? vec3(0.78, 0.79, 0.8) : g;
        } else if (!door && dq.x < hs.x + 0.05 && fv > c.y + hs.y && fv < c.y + hs.y + 0.26) {
          col = wall * 0.82; // 雨戸の戸袋
        }
      }
    } else if (style < 1.5) {
      // アパート: 各階にベランダと掃き出し窓
      float slot = 3.6, si = floor(u / slot), fu = u - si * slot;
      bool inSlot = u > 0.4 && u < len - 0.4;
      if (inSlot && len > 7.0) {
        vec2 dq = abs(vec2(fu, fv) - vec2(slot * 0.5, 1.15));
        if (dq.x < 1.25 && dq.y < 1.0) col = mix(glassA, glassB, smoothstep(0.1, 2.1, fv) * 0.7);
        if (fl > 0.5 && fv < 1.1 && dq.x < 1.6) {
          float bars = step(0.5, fract(fu / 0.12));
          col = mix(wall * 0.88, vec3(0.3, 0.32, 0.36), 0.25 + bars * 0.1);
          if (fv > 1.0) col = wall * 0.7;
        }
      } else if (inSlot) {
        vec2 dq = abs(vec2(fract(u / 2.4) * 2.4, fv) - vec2(1.2, 1.5));
        if (dq.x < 0.45 && dq.y < 0.45) col = mix(glassA, glassB, 0.4);
      }
      if (fv > fh - 0.12) col *= 0.9;
    } else if (style < 2.5) {
      // 公共施設: 横長の連続窓
      if (u > 0.8 && u < len - 0.8 && fv > 0.9 && fv < 2.4) {
        float mull = step(0.06, abs(fract(u / 1.5) - 0.5) * 1.5);
        col = mull > 0.0 ? mix(glassA, glassB, smoothstep(0.9, 2.4, fv) * 0.8) : vec3(0.75);
      }
      if (fv > fh - 0.25) col *= 0.93;
    } else if (style < 3.5) {
      // 倉庫: 波板とシャッター
      col *= 0.93 + 0.07 * step(0.5, fract(u / 0.22));
      if (abs(u - len * 0.5) < 2.3 && v < 3.6 && len > 8.0) col = vec3(0.7, 0.72, 0.73) * (0.9 + 0.1 * step(0.5, fract(v / 0.15)));
    } else {
      // 商店の 1 階: ガラス戸と柱
      if (fv > 0.2 && fv < 2.5 && u > 0.4 && u < len - 0.4) {
        float pil = step(0.12, abs(fract(u / 3.5) - 0.5) * 3.5);
        col = pil > 0.0 ? mix(glassA, glassB, 0.5) : wall * 0.85;
      }
      if (fv > 2.5 && fv < 3.2) col = vec3(0.25, 0.4, 0.62);
    }
  }
  // 壁の下のほうを少し暗く（地面の照り返しの陰）
  col *= mix(0.8, 1.0, smoothstep(0.0, 1.6, v));
  diffuseColor.rgb = col;
}`;
