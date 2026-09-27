// 住宅地の区画: 道沿いに敷地を割り、家（assets/house.js）・塀・駐車場・庭・車・自転車を置く
import * as THREE from 'three';
import { resample } from './mesher.js';
import { M, roadW, PAVED, PLACES } from './layout.js';
import { rng, hash2 } from './data.js';
import { townDensity } from './scenery/plan.js';
import { inHamlet, byChannel } from './scenery/frontage.js';
import { Kit, kitMaterials } from './assets/kit.js';
import { texMat } from './assets/textures.js';
import { buildHouse, houseSpec } from './assets/house.js';
import { car, bicycle, blockWall, aluFence, vendingMachine, recycleBin } from './assets/props.js';

const C = (h) => new THREE.Color(h);
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

// 地面に貼る面（すこし浮かせて、奥に沈めない）
let FLAT = null;
export function flatMaterials() {
  if (FLAT) return FLAT;
  const po = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
  FLAT = { fConcrete: texMat('concrete', po), fGravel: texMat('gravel', po), fPaving: texMat('paving', po), fDirt: texMat('dirt', po), fGrass: texMat('grassGround', po) };
  for (const m of Object.values(FLAT)) m.userData.noShadow = true;
  return FLAT;
}

export class Lots {
  constructor(ctx, B, trees) {
    this.ctx = ctx; this.B = B; this.trees = trees;
    this.kit = new Kit({ ...kitMaterials(), ...flatMaterials() });
    this.lots = [];
    this.fieldLots = []; // 家を建てない敷地 → 田んぼ（scenery/paddies.js）
  }

  // 敷地の四角い地面（四隅の高さに沿わせる）
  flat(F, a0, b0, a1, b1, mat, col = C('#ffffff'), lift = 0.03) {
    const { ground } = this.ctx;
    const P = (a, b) => { const [x, z] = F(a, b); return [x, ground(x, z) + lift, z]; };
    const pts = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)];
    const uvs = pts.map((p) => [p[0], p[2]]);
    const up = ((pts[1][2] - pts[0][2]) * (pts[3][0] - pts[0][0]) - (pts[1][0] - pts[0][0]) * (pts[3][2] - pts[0][2])) > 0;
    this.kit.at(new THREE.Matrix4()).color(col);
    if (up) this.kit.face(mat, pts, uvs); else this.kit.face(mat, [pts[0], pts[3], pts[2], pts[1]], [uvs[0], uvs[3], uvs[2], uvs[1]]);
    if (mat !== 'fGrass') this.ctx.mask.fillPoly([F(a0, b0), F(a1, b0), F(a1, b1), F(a0, b1)], M.PAVE);
  }

  // 敷地のローカル (a, b) → 世界の行列（家などを置く。ローカル +z が道の方）
  frame(lot, a, b, y) {
    const [x, z] = lot.Fn(a, b);
    const zAxis = new THREE.Vector3(-lot.nx, 0, -lot.nz), yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
    return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(x, y, z);
  }

  build(V) {
    const { mask, ground } = this.ctx;
    const kinds = new Set(['residential', 'unclassified', 'tertiary', 'living_street', 'secondary', 'trunk', 'service']);
    const STOP = M.ROAD | M.BLD | M.WATER | M.RAIL | M.AREA | M.HARBOR | M.KEEP | M.BEACH | M.LOT;
    for (const road of V.roads) {
      if (!kinds.has(road.k)) continue;
      const hw = roadW(road.k) / 2;
      const pts = resample(road.p, 0.5);
      const L = pts.length * 0.5;
      const r = rng(Math.floor(hash2(road.p[0][0] * 7.3, road.p[0][1] * 3.1) * 1e9) + 11);
      const at = (d) => pts[Math.max(0, Math.min(pts.length - 1, Math.round(d / 0.5)))];
      for (const side of [1, -1]) {
        let t = 1 + r() * 3;
        while (t < L - 6) {
          const Fw = 10 + r() * 4;
          const q0 = at(t), q1 = at(t + Fw), q = at(t + Fw / 2);
          if (q0.tx * q1.tx + q0.tz * q1.tz < 0.94) { t += 2; continue; }
          const ux = q.tx, uz = q.tz, nx = q.nx * side, nz = q.nz * side;
          const front = hw + 0.75;
          const Fn = (a, b) => [q.x + ux * a + nx * (front + b), q.z + uz * a + nz * (front + b)];
          const cF = Fn(0, 4);
          if (!(mask.get(cF[0], cF[1]) & M.TOWN)) { t += 3; continue; }
          // 家はまばらに（景色の方針: 住宅は少なめ）。建てない敷地は田んぼ、ときどき家庭菜園
          // 定食屋の前の田んぼの左手（家の集まり）は家を多めに。建てない敷地は小さな田にする
          const hamlet = inHamlet(cF[0], cF[1]);
          const skip = r() > (hamlet ? 0.9 : townDensity(cF[0], cF[1])), veg = r() < 0.3;
          let avail = 0;
          for (let b = 1; b <= 30; b += 0.5) {
            const [x, z] = Fn(0, b);
            if (mask.anyInRect(x, z, ux, uz, Fw - 0.4, 0.6, STOP)) break;
            avail = b;
          }
          if (avail < 7) { t += 2; continue; }
          let D = avail >= 24 ? Math.min(avail - 0.5, 11 + r() * 4) : avail >= 14 ? avail / 2 - 0.2 : avail - 0.3;
          if (D < 7) { t += 2; continue; }
          const hs = [[-Fw / 2, 0.5], [Fw / 2, 0.5], [-Fw / 2, D], [Fw / 2, D]].map(([a, b]) => ground(...Fn(a, b)));
          if (Math.min(...hs) < 0.5 || Math.max(...hs) - Math.min(...hs) > 2.5) { t += 3; continue; }
          // 歩ける所（行き先のまわり）の近くは田んぼにしない（家庭菜園にする）
          const nearSpot = [[PLACES.start.x, PLACES.start.z], PLACES.teishoku.spot, PLACES.lab.spot].some((s) => s && Math.hypot(cF[0] - s[0], cF[1] - s[1]) < 34);
          if (skip && ((!veg && !nearSpot) || hamlet)) {
            // 田んぼ: 敷地の四角をそのまま渡す（道に沿った向き）
            mask.fillPoly([Fn(-Fw / 2, 0), Fn(Fw / 2, 0), Fn(Fw / 2, D), Fn(-Fw / 2, D)], M.LOT);
            this.fieldLots.push({ Fn, F: Fw, D, ux, uz, nx, nz });
            t += Fw + 0.3;
            continue;
          }
          const lot = { Fn, ux, uz, nx, nz, F: Fw, D, yaw: Math.atan2(nx, nz), r: rng(Math.floor(r() * 1e9) + 1), q, side, field: skip, hamlet };
          mask.fillPoly([Fn(-Fw / 2, 0), Fn(Fw / 2, 0), Fn(Fw / 2, D), Fn(-Fw / 2, D)], M.LOT);
          this.fillLot(lot);
          this.lots.push(lot);
          t += Fw + 0.3;
        }
      }
      if (PAVED.has(road.k) && road.k !== 'service' && road.k !== 'trunk' && road.k !== 'secondary') this.gutter(road, hw);
    }
  }

  // 道の両脇の側溝（コンクリートのふた）
  gutter(road, hw) {
    const { mask, ground } = this.ctx;
    const pts = resample(road.p, 2);
    const k = this.kit.at(new THREE.Matrix4()).color(C('#e6e3dc'));
    k.chunk(pts[Math.floor(pts.length / 2)].x, pts[Math.floor(pts.length / 2)].z);
    for (const s of [1, -1]) {
      for (let q = 0; q < pts.length - 1; q++) {
        const A = pts[q], Bq = pts[q + 1];
        const mx = (A.x + Bq.x) / 2 + A.nx * s * (hw + 0.28), mz = (A.z + Bq.z) / 2 + A.nz * s * (hw + 0.28);
        if (!(mask.get(mx, mz) & M.TOWN) || (mask.get(mx, mz) & M.WATER) || byChannel(mx, mz)) continue; // 用水路の所（frontage.js）には置かない
        const P = (p, o) => { const x = p.x + p.nx * s * o, z = p.z + p.nz * s * o; return [x, ground(x, z) + 0.1, z]; };
        const f4 = [P(A, hw + 0.03), P(Bq, hw + 0.03), P(Bq, hw + 0.5), P(A, hw + 0.5)];
        const uv = [[A.d, 0], [Bq.d, 0], [Bq.d, 0.47], [A.d, 0.47]];
        if (s > 0) k.face('fConcrete', f4, uv); else k.face('fConcrete', [f4[1], f4[0], f4[3], f4[2]], [uv[1], uv[0], uv[3], uv[2]]);
      }
    }
  }

  fillLot(lot) {
    const { F, D, r, Fn } = lot;
    this.kit.chunk(...Fn(0, D / 2));
    const { ground } = this.ctx;
    const k = this.kit, trees = this.trees;
    const type = lot.field || (!lot.hamlet && r() < 0.06) ? 'field' : 'house';
    const drive = r() < 0.5 ? -1 : 1;
    const setback = D < 10 ? 1.6 + r() * 0.8 : 2.6 + r() * 1.6;
    const w = Math.min(F - 3.6, 7.2 + r() * 2.6), d = Math.max(5.6, Math.min(D - setback - 0.9, 6.8 + r() * 2.2));
    const ha = -drive * (F / 2 - 0.7 - w / 2);
    const hb = setback + d / 2;
    const gy = (a, b) => ground(...Fn(a, b));
    const fenceKind = type === 'field' ? 'none' : ['block', 'block', 'hedge', 'alu', 'none', 'block'][Math.floor(r() * 6)];

    if (type === 'field') {
      // 家庭菜園: 畝と野菜の列（scenery/paddies.js の畑として描く）。角に植え込み
      this.fieldLots.push({ Fn, F, D, ux: lot.ux, uz: lot.uz, nx: lot.nx, nz: lot.nz, veg: true });
      const [x, z] = Fn((r() < 0.5 ? -1 : 1) * (F / 2 - 1), D - 1);
      trees.add('shrub', x, ground(x, z), z, 0.7 + r() * 0.3);
      return;
    }
    // 家
    let hmax = -Infinity;
    for (const [a, b] of [[ha - w / 2, hb - d / 2], [ha + w / 2, hb - d / 2], [ha - w / 2, hb + d / 2], [ha + w / 2, hb + d / 2]]) hmax = Math.max(hmax, gy(a, b));
    const spec = houseSpec(r, w, d);
    spec.southFront = -lot.nz > 0.2;
    buildHouse(k, this.frame(lot, ha, hb, hmax), spec, r);
    const corners = [Fn(ha - w / 2, hb - d / 2), Fn(ha + w / 2, hb - d / 2), Fn(ha + w / 2, hb + d / 2), Fn(ha - w / 2, hb + d / 2)];
    this.ctx.segs.addPoly(corners, hmax + 7);
    this.ctx.mask.fillPoly(corners, M.BLD);

    // 地面: 駐車場（コンクリート）・庭
    const da = drive * (F / 2 - 1.8);
    this.flat(Fn, da - 1.5, 0.05, da + 1.5, setback + d * 0.6, 'fConcrete', C('#f4f2ec'));
    const ga0 = drive > 0 ? -F / 2 + 0.3 : da + 1.6, ga1 = drive > 0 ? da - 1.6 : F / 2 - 0.3;
    const garden = r() < 0.55;
    if (ga1 - ga0 > 0.8) this.flat(Fn, ga0, 0.4, ga1, setback - 0.2, garden ? 'fGrass' : 'fGravel', garden ? C('#e8f0d8') : C('#f2f0ea'));
    // 車・自転車
    if (setback > 2.4 && r() < 0.6) car(k, this.frame(lot, da, 2.3, gy(da, 2.3) + 0.03).multiply(new THREE.Matrix4().makeRotationY(r() < 0.5 ? 0 : Math.PI)), r);
    if (r() < 0.45) bicycle(k, this.frame(lot, da + drive * 0.2, setback - 0.6, gy(da, setback - 0.6)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2 + (r() - 0.5) * 0.4)), pick([C('#c8423a'), C('#e8e8e4'), C('#2f5a9a'), C('#1e1e1e'), C('#e0b030'), C('#8fb8a0'), C('#d8a8b0')], r), r);
    // 庭木と植え込み
    if (ga1 - ga0 > 1.2) {
      if (r() < 0.55) { const [x, z] = Fn((ga0 + ga1) / 2, setback * 0.55); const pine = r() < 0.4; trees.add(pine ? 'pine' : 'shrub', x, ground(x, z), z, pine ? 0.5 + r() * 0.2 : 0.9 + r() * 0.5); }
      if (r() < 0.5) { const [x, z] = Fn(ga0 + 0.6, 0.9); trees.add('shrub', x, ground(x, z), z, 0.7 + r() * 0.3); }
    }
    if (r() < 0.45) { const [x, z] = Fn(-drive * (F / 2 - 1.0), D - 1.1); trees.add(r() < 0.3 ? 'cherry' : 'broad', x, ground(x, z), z, 0.45 + r() * 0.25); }

    // 塀（前）: 車と人の出入口をあける
    const gate = [da - 1.6, da + 1.6];
    // ときどき自販機: 塀の角を切り欠いて、道に向けて置く
    const vend = fenceKind !== 'hedge' && r() < 0.05, bin = vend && r() < 0.7;
    const va = -drive * (F / 2 - 1.0), ba = va + drive * 0.78;
    const holes = [gate];
    if (vend) holes.push(bin ? [Math.min(va, ba) - 0.56, Math.max(va, ba) + 0.56] : [va - 0.56, va + 0.56]);
    const runs = [];
    let a0 = -F / 2;
    for (const [h0, h1] of holes.sort((p, q) => p[0] - q[0])) { if (h0 > a0) runs.push([a0, h0]); a0 = Math.max(a0, h1); }
    if (a0 < F / 2) runs.push([a0, F / 2]);
    k.at(new THREE.Matrix4());
    for (const [a0, a1] of runs) {
      if (a1 - a0 < 0.3) continue;
      const A = Fn(a0, 0.12), Bp = Fn(a1, 0.12);
      if (fenceKind === 'block') {
        blockWall(k, A, Bp, 1.05 + r() * 0.3, ground);
        this.ctx.segs.add(A[0], A[1], Bp[0], Bp[1], 0.1);
      } else if (fenceKind === 'alu') {
        blockWall(k, A, Bp, 0.55, ground);
        aluFence(k, A, Bp, 0.75, (x, z) => ground(x, z) + 0.58, pick([C('#4a4038'), C('#c8ccd0'), C('#3a3a3a')], r));
        this.ctx.segs.add(A[0], A[1], Bp[0], Bp[1], 0.1);
      } else if (fenceKind === 'hedge') {
        for (let s = 0.4; s < a1 - a0; s += 0.75) {
          const [x, z] = Fn(a0 + s, 0.45);
          trees.add('shrub', x, ground(x, z) - 0.1, z, 0.95 + r() * 0.2);
        }
        this.ctx.segs.add(...Fn(a0, 0.45), ...Fn(a1, 0.45), 0.35);
      }
    }
    // 門柱・郵便受け
    if (fenceKind === 'block' || fenceKind === 'alu') {
      k.at(this.frame(lot, gate[1] + 0.25, 0.15, gy(gate[1] + 0.25, 0.15))).color(C('#dcd6ca'));
      k.box('mortar', 0, 0.7, 0, 0.45, 1.4, 0.35);
      k.color(C('#7d8a93')); k.box('metal', 0, 1.05, 0.2, 0.3, 0.22, 0.06);
      k.color(C('#f0ead8')); k.box('trim', 0, 1.3, 0.18, 0.28, 0.08, 0.02);
    }
    // 隣との境（片側）: 低いブロック塀
    if (r() < 0.6) {
      k.at(new THREE.Matrix4());
      blockWall(k, Fn(F / 2 - 0.1, 0.3), Fn(F / 2 - 0.1, D - 0.3), 0.6 + r() * 0.5, ground);
      this.ctx.segs.add(...Fn(F / 2 - 0.1, 0.3), ...Fn(F / 2 - 0.1, D - 0.3), 0.08);
    }
    if (vend) {
      k.chunk(...Fn(va, 0.4));
      vendingMachine(k, this.frame(lot, va, 0.4, gy(va, 0.4)), r);
      this.ctx.segs.add(...Fn(va, 0.4), ...Fn(va, 0.4), 0.6);
      if (bin) { recycleBin(k, this.frame(lot, ba, 0.3, gy(ba, 0.3)), pick([C('#2f8f4e'), C('#2a64b8'), C('#e8e8e4')], r)); this.ctx.segs.add(...Fn(ba, 0.3), ...Fn(ba, 0.3), 0.3); }
    }
  }

  meshes() { return this.kit.meshes(); }
}
