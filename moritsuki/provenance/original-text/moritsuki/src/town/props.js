// 電柱と電線・ポストなど、町の小物（自販機・車・自転車は assets/ の kit 版）
import * as THREE from 'three';
import { Mesher, resample } from './mesher.js';
import { M, roadW, PLACES } from './layout.js';
import { rng, hash2 } from './data.js';
import { lambert } from './materials.js';
import { Kit, kitMaterials } from './assets/kit.js';
import { pole, wire } from './assets/props.js';

const C = (h) => new THREE.Color(h);

// 定食屋のまわり: 店の裏（海沿いの道）には電柱を立てず、店の近くを通る引き込み線は 1 本だけにする
const SHOKU = (() => {
  const P = PLACES.teishoku, S = PLACES.street;
  const loc = (x, z) => [(x - P.x) * S.dir[0] + (z - P.z) * S.dir[1], (x - P.x) * S.n[0] + (z - P.z) * S.n[1]];
  return {
    behind: (x, z) => { const [t, o] = loc(x, z); return Math.abs(t) < P.w / 2 + 8 && o > -P.d / 2 + 1 && o < P.d / 2 + 8; },
    // 線分 a–b が店の中心から 16 m 以内を通るか
    near: (a, b) => {
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const u = Math.max(0, Math.min(1, ((P.x - a.x) * dx + (P.z - a.z) * dz) / L2));
      return Math.hypot(a.x + dx * u - P.x, a.z + dz * u - P.z) < 16;
    },
  };
})();

// 電柱の配置（2 段階）: まず道ぞいに位置を決めて電線でつなぐ列（run）をつくり、
// どこにもつながらない 1 本だけの電柱は近くの電柱へ引き込み線でつなぐ。つなげる相手がなければ立てない。
export function buildPoles(ctx) {
  const { data, ground, mask, segs } = ctx;
  const kit = new Kit(kitMaterials());
  const kinds = new Set(['residential', 'unclassified', 'tertiary', 'secondary', 'trunk', 'living_street']);
  // 定食屋の前の農道の電柱（frontage.js が先に立てている）も、つなぐ相手・間隔の判定に入れる
  const fixed = (ctx.fixedPoles || []).map((p) => ({ ...p, fixed: true }));
  const plan = [...fixed];
  const runs = [];
  for (const road of data.V.roads) {
    if (!kinds.has(road.k)) continue;
    const hw = roadW(road.k) / 2;
    const pts = resample(road.p, 1);
    const r = rng(Math.floor(hash2(road.p[0][0] * 1.7, road.p[0][1] * 2.9) * 1e9) + 3);
    const side = r() < 0.5 ? 1 : -1;
    const spacing = 30 + r() * 8;
    let run = null;
    for (let t = 4 + r() * 10; t < pts.length - 2; t += spacing) {
      const q = pts[Math.floor(t)];
      const x = q.x + q.nx * side * (hw + 0.55), z = q.z + q.nz * side * (hw + 0.55);
      const mm = mask.get(x, z);
      if (!(mm & M.TOWN) || (mm & (M.BLD | M.WATER)) || SHOKU.behind(x, z)) { run = null; continue; }
      if (plan.some((p) => Math.hypot(p.x - x, p.z - z) < 12)) { run = null; continue; }
      const p = { x, z, nx: q.nx, nz: q.nz, seed: r() };
      if (run && Math.hypot(run.at(-1).x - x, run.at(-1).z - z) >= 50) run = null;
      if (!run) { run = []; runs.push(run); }
      run.push(p);
      plan.push(p);
    }
  }
  // 農道の電柱の道側の 1 本は、道ぞいの列から引き込む（定食屋の前を通る引き込み線はこれ 1 本にする）
  const links = [];
  const keep = new Set(fixed);
  for (const run of runs) if (run.length > 1) for (const p of run) keep.add(p);
  let shokuLink = false;
  for (const p of fixed) {
    if (!p.feed) continue;
    let best = null, bd = 45;
    for (const o of keep) {
      if (o.fixed) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d > 6 && d < bd) { bd = d; best = o; }
    }
    if (best) { links.push([best, p]); shokuLink ||= SHOKU.near(best, p); }
  }
  // 1 本だけの電柱: いちばん近い電柱（40 m 以内）へ引き込み線でつなぐ。なければ立てない
  const lone = runs.filter((run) => run.length === 1).map((run) => run[0]);
  for (const p of lone) {
    let best = null, bd = 40;
    for (const o of keep) {
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d > 8 && d < bd && !(shokuLink && SHOKU.near(o, p))) { bd = d; best = o; }
    }
    if (best) { keep.add(p); links.push([best, p]); shokuLink ||= SHOKU.near(best, p); }
  }
  const poles = [];
  const at = new Map();
  for (const p of fixed) at.set(p, p);
  for (const p of plan) {
    if (p.fixed || !keep.has(p)) continue;
    const { x, z } = p, y = ground(x, z);
    kit.chunk(x, z);
    // ローカル x = 道と直角、z = 道に沿う
    const xAxis = new THREE.Vector3(p.nx, 0, p.nz), yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
    const Mx = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(x, y, z);
    const r = rng(Math.floor(p.seed * 1e9) + 7);
    const att = pole(kit, Mx, r, { transformer: r() < 0.3, lamp: r() < 0.35, plate: r() < 0.5 });
    const w = (a) => new THREE.Vector3(...a).applyMatrix4(Mx).toArray();
    at.set(p, { x, z, power: att.power.map(w), tel: att.tel.map(w) });
    segs.add(x, z, x, z, 0.2);
    poles.push([x, z]);
  }
  kit.at(new THREE.Matrix4()).color(new THREE.Color('#1e1e20'));
  for (const run of runs) {
    for (let i = 1; i < run.length; i++) {
      if (!keep.has(run[i - 1]) || !keep.has(run[i])) continue;
      const a = at.get(run[i - 1]), b = at.get(run[i]);
      kit.chunk((a.x + b.x) / 2, (a.z + b.z) / 2);
      const n = Math.min(a.power.length, b.power.length);
      for (let k = 0; k < n; k++) wire(kit, a.power[k], b.power[k], 0.011, 0.02);
      wire(kit, a.tel[0], b.tel[0], 0.028, 0.03);
    }
  }
  // 引き込み線: 上の腕金の 3 本と通信線。電線が交差しないよう、つなぐ向きと直角の方向で並べて対にする
  for (const [pa, pb] of links) {
    const a = at.get(pa), b = at.get(pb);
    const sx = -(b.z - a.z), sz = b.x - a.x;
    const ord = (ps) => ps.slice(0, 3).sort((u, v) => (u[0] * sx + u[2] * sz) - (v[0] * sx + v[2] * sz));
    const pa3 = ord(a.power), pb3 = ord(b.power);
    kit.chunk((a.x + b.x) / 2, (a.z + b.z) / 2);
    for (let k = 0; k < 3; k++) wire(kit, pa3[k], pb3[k], 0.011, 0.025);
    wire(kit, a.tel[0], b.tel[0], 0.028, 0.035);
  }
  const group = new THREE.Group();
  for (const m of kit.meshes()) group.add(m);
  group.name = 'poles';
  const dropped = lone.filter((p) => !keep.has(p)).length;
  group.userData.stats = { planned: plan.length - fixed.length, lone: lone.length, kept: poles.length, dropped };
  group.userData.spans = [
    ...runs.flatMap((run) => run.slice(1).map((p, i) => [run[i], p])).filter(([a, b]) => keep.has(a) && keep.has(b)),
    ...links,
  ].map(([a, b]) => [a.x, a.z, b.x, b.z]);
  return { group, poles };
}

export function postBox(m, x, y, z, yaw) {
  const red = C('#d42a22');
  m.box(x, y + 0.45, z, 0.15, 0.9, 0.15, yaw, C('#444'));
  m.box(x, y + 1.15, z, 0.5, 0.55, 0.4, yaw, red);
  m.box(x, y + 1.46, z, 0.56, 0.08, 0.46, yaw, red);
}
