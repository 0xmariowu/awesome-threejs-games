// 目印になる場所: 自分の家・公園・定食屋・駅・研究所・漁港の船（船そのものは assets/boats.js）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mesher, resample } from './mesher.js';
import { PLACES, M } from './layout.js';
import { STYLE } from './buildings.js';
import { lambert, textTexture } from './materials.js';
import { postBox } from './props.js';
import { vendingMachine, recycleBin, bicycle } from './assets/props.js';
import { obb, rng, hash2, pointInPoly, bbox, polylineDist } from './data.js';
import { placeBlock } from './blocks.js';
import { boatSpec, ferrySpec, buildFleet, boatPoint, mooring } from './assets/boats.js';
import { buildHome } from './assets/home.js';
import { buildShokudo } from './assets/shokudo.js';
import { buildOwnerHome, OWNER_STAGES } from './assets/ownerHome.js';
import { buildLab, LAB } from './assets/lab.js';
import { buildLabStage } from './assets/labStages.js';
import { StageSite } from './stageSite.js';
import { buildPark } from './assets/park.js';

const C = (h) => new THREE.Color(h);

// 場所のローカル座標（+z = 正面）→ 世界座標
const frame = (p) => {
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  return { W: (a, b) => [p.x + a * c + b * s, p.z - a * s + b * c], ux: c, uz: -s, s, c };
};

export function buildLandmarks(ctx, B, forest, kit) {
  const { ground, segs, deck, mask, data } = ctx;
  // 小物（kit に積む）: 自販機（bin = リサイクルボックスを置く側 ±1）
  const place = (x, z, yaw) => { kit.chunk(x, z); return new THREE.Matrix4().makeRotationY(yaw).setPosition(x, ground(x, z), z); };
  const vend = (x, z, yaw, seed, bin = 0) => {
    vendingMachine(kit, place(x, z, yaw), rng(seed * 1000 + 5));
    segs.add(x, z, x, z, 0.6);
    if (!bin) return;
    const bx = x + Math.cos(yaw) * 0.78 * bin, bz = z - Math.sin(yaw) * 0.78 * bin;
    recycleBin(kit, place(bx, bz, yaw));
    segs.add(bx, bz, bx, bz, 0.3);
  };
  const m = new Mesher();
  const group = new THREE.Group();
  const signs = [];
  const sign = (text, opts, w, h, x, y, z, yaw, two = false) => {
    const tex = textTexture(text, opts);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: two ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    group.add(mesh);
    signs.push(mesh);
    return mesh;
  };

  // 目印の建物の敷地: ローカル (a, b)（+b = 正面）→ 世界。建物のアセット（assets/home.js など）に渡す道具一式
  // o: 建て替えできる敷地（stageSite.js）の入れ物 { kit, trees, rec }。建物は o.kit、木は o.trees に積み、当たりは o.rec に覚える
  const lotEnv = (p, baseAt, o = null) => {
    const F = frame(p), W = F.W;
    let base = -Infinity;
    for (const [a, b] of baseAt) base = Math.max(base, ground(...W(a, b)));
    const M0 = new THREE.Matrix4().makeRotationY(p.yaw).setPosition(p.x, base, p.z);
    return {
      M: M0, base, W,
      gy: (a, b) => ground(...W(a, b)) - base,
      at: (a, b, yaw = 0, y) => M0.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(a, y ?? ground(...W(a, b)) - base, b)),
      chunk: (a, b) => (o ? o.kit : kit).chunk(...W(a, b)),
      tree: (kind, a, b, sc) => { const [x, z] = W(a, b); (o ? o.trees : forest).add(kind, x, ground(x, z), z, sc); },
      solid: (poly, top) => { const pts = poly.map(([a, b]) => W(a, b)); const s = segs.addPoly(pts, base + top); o?.rec.push(...s); mask.fillPoly(pts, M.BLD); },
      fence: (a0, b0, a1, b1, r = 0.1) => { const s = segs.add(...W(a0, b0), ...W(a1, b1), r); o?.rec.push(s); },
      deck: (poly, y) => deck.poly(poly.map(([a, b]) => W(a, b)), base + y),
      pave: (poly) => mask.fillPoly(poly.map(([a, b]) => W(a, b)), M.PAVE),
      vend: (a, b, yaw, seed, bin) => { const [x, z] = W(a, b); vend(x, z, p.yaw + yaw, seed, bin); },
    };
  };
  // 建て替えできる敷地（湊さんの家・研究所）。r = 敷地ローカルの四角 [a0, b0, a1, b1]（マスク・草を戻す範囲）
  const sites = {};
  const stageSite = (id, p, baseAt, r, levels, level, kindOf, layout) => {
    const o = { kit: null, trees: null, rec: [] };
    const env = lotEnv(p, baseAt, o);
    const cs = [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]].map(([a, b]) => env.W(a, b));
    const rect = [Math.min(...cs.map((q) => q[0])), Math.min(...cs.map((q) => q[1])), Math.max(...cs.map((q) => q[0])), Math.max(...cs.map((q) => q[1]))];
    // 世界 → 敷地ローカル
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const local = (x, z) => { const dx = x - p.x, dz = z - p.z; return [dx * c - dz * s, dx * s + dz * c]; };
    const site = new StageSite({ id, name: p.name, levels, level, env, opts: o, mats: kit.mats, rect, ctx: { mask, deck, segs },
      kindOf: kindOf && ((x, z, lv) => kindOf(...local(x, z), lv)), toLocal: local, layout });
    site.build(level, group);
    sites[id] = site;
    return site;
  };
  const lotMask = (p) => {
    const F = frame(p), hw = p.w / 2, hd = p.d / 2;
    mask.fillPoly([F.W(-hw, -hd), F.W(hw, -hd), F.W(hw, hd), F.W(-hw, hd)], M.LOT);
  };

  // ---------- 自分の家（大きめの平屋） ----------
  {
    const p = PLACES.home;
    lotMask(p);
    const env = lotEnv(p, [[-9.3, -4.6], [5.3, -4.6], [-9.3, 3.8], [5.3, 3.8]]);
    buildHome(kit, env, rng(37));
    // ファストトラベルで降りる所: 家の前の道。カーポートの側から、門と縁側を斜めに見る（カメラが公園の柵の中に入らない向き）
    p.spot = env.W(6, 7.6); p.look = env.W(-4, 3.5);
  }

  // ---------- 吉山新町公園 ----------
  // 地図の道（園の右と奥を通る）にかからない大きさ。遊具・地面は assets/park.js
  {
    const p = PLACES.park, F = frame(p), hw = p.w / 2, hd = p.d / 2;
    const env = lotEnv(p, [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]);
    // 芝は刈り込んだ短い芝（まわりの空き地の伸びた草と分ける）
    for (let aa = -hw; aa <= hw; aa += 0.8) for (let bb = -hd; bb <= hd; bb += 0.8) {
      const c = mask.cell(...F.W(aa, bb));
      if (c >= 0 && !(mask.a[c] & (M.ROAD | M.WATER | M.BLD))) mask.a[c] |= M.LAWN;
    }
    buildPark(kit, env, p, rng(71));
    // フェンス（金網）: 道側（+z）に 2 か所の入口
    const fence = [];
    const post = C('#a9aeb0');
    const edges = [[[-hw, hd], [hw, hd]], [[hw, hd], [hw, -hd]], [[hw, -hd], [-hw, -hd]], [[-hw, -hd], [-hw, hd]]];
    const gaps = [[-hw + 4.2, -hw + 7.4], [hw - 7.4, hw - 4.2]];
    edges.forEach(([A, Bp], ei) => {
      const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), n = Math.ceil(len / 2.4);
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const a0 = A[0] + (Bp[0] - A[0]) * t0, b0 = A[1] + (Bp[1] - A[1]) * t0, a1 = A[0] + (Bp[0] - A[0]) * t1, b1 = A[1] + (Bp[1] - A[1]) * t1;
        if (ei === 0 && gaps.some(([g0, g1]) => (a0 + a1) / 2 > g0 && (a0 + a1) / 2 < g1)) continue;
        const [x0, z0] = F.W(a0, b0), [x1, z1] = F.W(a1, b1);
        const y0 = ground(x0, z0), y1 = ground(x1, z1);
        fence.push([x0, y0, z0, x1, y1, z1]);
        const g = new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6); g.translate(0, 0.95, 0);
        m.merge(g, new THREE.Matrix4().setPosition(x0, y0, z0), post);
        rail(m, x0, y0 + 1.85, z0, x1, y1 + 1.85, z1, 0.05, post);
        segs.add(x0, z0, x1, z1, 0.1);
      }
    });
    group.add(chainLink(fence));
    // 入口の車止め（U 字のパイプ）
    for (const [g0, g1] of gaps) {
      const [x0, z0] = F.W(g0 + 0.9, hd), [x1, z1] = F.W(g1 - 0.9, hd);
      const y0 = ground(x0, z0), y1 = ground(x1, z1);
      rail(m, x0, y0 + 0.7, z0, x1, y1 + 0.7, z1, 0.06, C('#e8e4da'));
      for (const [x, z, y] of [[x0, z0, y0], [x1, z1, y1]]) m.box(x, y + 0.35, z, 0.06, 0.7, 0.06, 0, C('#e8e4da'));
    }
    // 道側に広葉樹、奥の角に桜
    for (const aa of [-hw + 2, -0.5, hw - 2]) { const [x, z] = F.W(aa, hd - 1.2); forest.add('b-oak', x, ground(x, z), z, 0.8 + hash2(aa, 3) * 0.12); }
    for (const [aa, bb] of [[-hw + 1.4, -hd + 1.4], [hw - 1.2, 1.5]]) { const [x, z] = F.W(aa, bb); forest.add('b-cherry', x, ground(x, z), z, 0.8); }
    // 自販機（公園の角の外）
    { const [x, z] = F.W(hw + 1.2, hd - 1.0); vend(x, z, p.yaw + Math.PI / 2, 3, 1); }
  }

  // ---------- 定食屋「定食 みなと」 ----------
  {
    const p = PLACES.teishoku;
    lotMask(p);
    const env = lotEnv(p, [[-10.5, -4.9], [2.3, -4.9], [-10.5, 2.2], [2.3, 2.2]]);
    const r = buildShokudo(kit, env, rng(61));
    // 降りる所: 店の前の道。のれんの入口を向く
    p.spot = env.W(r.door[0] + 1.5, 8.4); p.look = env.W(r.door[0] - 1.0, 0);
    // 夏海の立つ所: のれんの右、店の前（降りる所から 4 m ほど先。道の方を向く）
    p.npc = env.W(r.door[0] + 1.65, 3.85);
    p.npcYaw = Math.atan2(p.spot[0] - p.npc[0], p.spot[1] - p.npc[1]) + 0.25;
  }

  // ---------- 定食屋の人（湊さん）の家: 定食屋に向かって左の空き地。段階（PLACES.owner.stage）で建て替わる ----------
  {
    const p = PLACES.owner;
    // 空き地のうちは敷地の地面（庭の色）にしない。草の地面のまま
    if (p.stage > 0) lotMask(p);
    // 建て替えたら（?debug の大きさえらび）、敷地の中の草は庭の短い草に
    const lot = (a, b) => a > -9.5 && a < 9.5 && b > -5.3 && b < 5.3;
    const site = stageSite('owner', p, [[-9.5, -5.3], [9.5, -5.3], [-9.5, 5.3], [9.5, 5.3]], [-11, -6.5, 11, 6.5],
      OWNER_STAGES.map((label, k) => ({ label, build: (k2, env) => buildOwnerHome(k2, env, k) })), p.stage,
      (a, b, lv) => (lv > 0 && lot(a, b) ? 'yard' : null));
    // 大きさえらびの立ち位置: 敷地の前の道のきわ（家を見上げる）
    site.spot = site.env.W(0, 6.6); site.face = site.env.W(0, 0);
  }

  // ---------- 吉山駅 ----------
  {
    const plats = data.V.platforms;
    const sig = [230, -15.5];
    let best = null;
    for (const pl of plats) for (let k = 0; k < pl.p.length - 1; k++) {
      const [ax, az] = pl.p[k], [bx, bz] = pl.p[k + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 25) continue;
      const d = polylineDist(sig[0], sig[1], [pl.p[k], pl.p[k + 1]]);
      if (!best || d < best.d) best = { d, ax, az, bx, bz, l };
    }
    if (best) {
      const { ax, az, bx, bz, l } = best;
      const ux = (bx - ax) / l, uz = (bz - az) / l;
      // 平行な辺に沿って、信号の側へ
      let nx = -uz, nz = ux;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if ((sig[0] - mx) * nx + (sig[1] - mz) * nz < 0) { nx = -nx; nz = -nz; }
      const t = Math.max(12, Math.min(l - 12, (sig[0] - ax) * ux + (sig[1] - az) * uz));
      const cx = ax + ux * t + nx * 6.5, cz = az + uz * t + nz * 6.5;
      const yaw = Math.atan2(nx, nz);
      const r = placeBlock(ctx, kit, { cx, cz, ux, uz, w: 22, d: 8, floors: 1, fh: 3.6, kind: 'station', wall: 'mortar', wallCol: C('#f4f2eb'), fascia: C('#8e3b32') }, rng(20));
      const top = r.yTop;
      const maroon = C('#8e3b32');
      const P = { x: cx, z: cz, yaw }, F = frame(P);
      for (const [a, b, len, rot] of [[0, 4.35, 23, 0], [0, -4.35, 23, 0], [11.35, 0, 8.7, Math.PI / 2], [-11.35, 0, 8.7, Math.PI / 2]]) {
        const [x, z] = F.W(a, b);
        m.box(x, top - 0.1, z, len, 0.9, 0.3, yaw + rot, maroon);
      }
      // 入口のガラス戸
      { const [x, z] = F.W(1, 4.05); m.box(x, r.base + 1.1, z, 3.2, 2.2, 0.06, yaw, C('#9fb2bd')); }
      // 屋上の駅名板
      const [sx, sz] = F.W(3, 0.5);
      const s = sign('吉 山 駅', { w: 768, h: 180, bg: '#f7f7f4', fg: '#26303a', font: '900 120px "Zen Kaku Gothic New", sans-serif' }, 5.4, 1.25, sx, top + 0.95, sz, yaw);
      for (const e of [-2.2, 2.2]) { const [px, pz] = F.W(3 + e, 0.45); m.box(px, top + 0.4, pz, 0.08, 0.8, 0.08, 0, C('#666')); }
      // 駅前: 自販機とポスト
      { const [x, z] = F.W(-9, 6); vend(x, z, yaw, 11, 1); }
      { const [x, z] = F.W(-10.5, 6); vend(x, z, yaw, 12); }
      { const [x, z] = F.W(8, 7); postBox(m, x, ground(x, z), z, yaw); segs.add(x, z, x, z, 0.35); }
      PLACES.station.x = cx + nx * 8; PLACES.station.z = cz + nz * 8;
      PLACES.station.look = [cx, cz]; // ファストトラベルで降りたとき駅舎を向く
    }
  }

  // ---------- 水産研究所（8 階建ての研究棟を 2 棟） ----------
  {
    const L = PLACES.lab;
    const campus = data.V.areas.find((a) => a.n && a.n.includes('水産大学校')) || data.V.areas.filter((a) => a.k === 'school').sort((a, b) => Math.hypot(...center(a.p).map((v, i) => v - [L.x, L.z][i])) - Math.hypot(...center(b.p).map((v, i) => v - [L.x, L.z][i])))[0];
    const box = campus ? obb(campus.p) : { cx: L.x, cz: L.z, ux: 1, uz: 0, w: 90, d: 40 };
    // 正面（+z）は道の多い側へ
    let ux = box.ux, uz = box.uz;
    const probe = (s2) => { let n = 0; for (let t = 4; t < 60; t += 2) for (const o of [-30, 0, 30]) if (mask.get(box.cx - uz * s2 * t + ux * o, box.cz + ux * s2 * t + uz * o) & M.ROAD) n++; return n; };
    if (probe(-1) > probe(1)) { ux = -ux; uz = -uz; }
    const vx = -uz, vz = ux;
    // 建物と前庭が道・水・線路・ほかの建物にかからない所を、キャンパスの中心から探す
    const W0 = LAB.B.x1 - LAB.A.x0 + 4, D0 = LAB.plaza - LAB.A.z0 + 1, zc = (LAB.plaza + LAB.A.z0) / 2;
    let at = null;
    for (let r2 = 0; r2 <= 40 && !at; r2 += 4) for (const [du, dv] of r2 ? [[r2, 0], [-r2, 0], [0, r2], [0, -r2], [r2, r2], [-r2, r2], [r2, -r2], [-r2, -r2]] : [[0, 0]]) {
      const cx = box.cx + ux * du + vx * dv, cz = box.cz + uz * du + vz * dv;
      if (mask.anyInRect(cx + vx * zc, cz + vz * zc, ux, uz, W0, D0, M.ROAD | M.WATER | M.RAIL | M.KEEP)) continue;
      at = { x: cx, z: cz };
      break;
    }
    at ||= { x: box.cx, z: box.cz };
    const p = { x: at.x, z: at.z, yaw: Math.atan2(vx, vz) };
    // 敷地にかかる OSM の建物の当たりは外す（研究棟に置きかえる）
    const env = lotEnv(p, [[LAB.A.x0, LAB.A.z0], [LAB.B.x1, LAB.A.z0], [LAB.A.x0, 0], [LAB.B.x1, 0], [0, LAB.plaza]]);
    for (let a = LAB.A.x0 - 3; a <= LAB.B.x1 + 3; a += 0.7) for (let b = LAB.A.z0 - 2; b <= LAB.plaza + 1; b += 0.7) {
      const c = mask.cell(...env.W(a, b));
      if (c >= 0) mask.a[c] = (mask.a[c] & ~M.BLD) | M.KEEP;
    }
    // 段階: 0 = いまの研究所（lab.js）、1〜10 = 成長段階（labStages.js）。ゲームは頼まれごとの進みぐあい（PLACES.lab.stage、はじめは 1）。
    // 博士の頼みごとをこなすと建てかわる。?debug の大きさえらびでも建て替えられる
    const levels = [{ label: 'いまの研究所（8 階建て 2 棟）', build: (k2, e2) => buildLab(k2, e2, rng(99)) }];
    for (let lv = 1; lv <= 10; lv++) levels.push({ label: lv === 1 ? '1 階建て（浜の分室）' : `${lv} 階建て`, build: (k2, e2) => buildLabStage(k2, e2, lv, rng(99 + lv)) });
    // 段階ごとの配置: 歩ける範囲（成長段階のとき、建物の前の広がりを降りる所のまわりの円に足す）、磯貝博士の立つ所、
    // ファストトラベルで降りる所（spot）と降りたときに向く所（look）
    const labLayout = (st) => {
      const [a0, , a1, b1] = st.bounds || [LAB.A.x0, 0, LAB.B.x1, LAB.plaza];
      // 建物の正面の少し奥（建物の横も少し歩ける）から、前庭の先まで
      const za = -4, zb = Math.max(b1, 10) + 6, xa = a0 - 4, xb = a1 + 4;
      const [zx, zz] = env.W((xa + xb) / 2, (za + zb) / 2);
      // いまの研究所（0）はこれまでどおり円だけ
      const zone = st.level > 0 ? { x: zx, z: zz, ux: Math.cos(p.yaw), uz: -Math.sin(p.yaw), hw: (xb - xa) / 2, hd: (zb - za) / 2 } : null;
      // いまの研究所: 降りる所は前庭の手前の芝生のきわ（本館の玄関を斜めに見る）、博士は前庭の入口（車止めの内側）。
      // 成長段階: 博士は玄関の前の少し左に立ち、降りる所はその博士の前（4 m ほど手前、少し右）。博士と玄関を見る
      const ent = st.level > 0 && st.result?.entrance;
      if (!ent) {
        const spot = env.W(-12, LAB.plaza + 3.5), npc = env.W(-15.8, LAB.plaza - 1.6);
        return { zone, npc, npcYaw: Math.atan2(spot[0] - npc[0], spot[1] - npc[1]) - 0.2, spot, look: env.W((LAB.A.x0 + LAB.A.x1) / 2, 0) };
      }
      const na = ent[0] - 2.4, nb = ent[1] + 1.4;
      const npc = env.W(na, nb), spot = env.W(na + 1.3, nb + 4.0);
      return { zone, npc, npcYaw: Math.atan2(spot[0] - npc[0], spot[1] - npc[1]), spot, look: env.W(na + 0.2, nb - 3) };
    };
    const site = stageSite('lab', { ...p, name: '水産研究所' }, [[LAB.A.x0, LAB.A.z0], [LAB.B.x1, LAB.A.z0], [LAB.A.x0, 0], [LAB.B.x1, 0], [0, LAB.plaza]],
      [LAB.A.x0 - 24, LAB.A.z0 - 8, LAB.B.x1 + 24, LAB.plaza + 22], levels, Math.min(10, PLACES.lab.stage ?? 0), null, labLayout);
    // 構内のまわりは刈り込んだ芝生（土の出た空き地のまだらにしない）。
    // 建てかわるので、建物の下も芝にしておく（小さい段階で空いた所に芝が生える）
    const under = 0;
    for (let aa = LAB.A.x0 - 30; aa <= LAB.B.x1 + 30; aa += 0.8) for (let bb = LAB.A.z0 - 25; bb <= LAB.plaza + 60; bb += 0.8) {
      const c = mask.cell(...env.W(aa, bb));
      if (c >= 0 && !(mask.a[c] & (M.ROAD | M.WATER | M.RAIL | under))) mask.a[c] |= M.LAWN;
    }
    const e = env.W(0, LAB.plaza - 3);
    PLACES.lab.x = e[0]; PLACES.lab.z = e[1];
    // 降りる所・磯貝博士の立つ所は段階で変わる（labLayout。建て替えると main.js が博士と降りる所を動かす）
    PLACES.lab.spot = site.place.spot;
    PLACES.lab.look = site.place.look;
    PLACES.lab.npc = site.place.npc;
    PLACES.lab.npcYaw = site.place.npcYaw;
    // 大きさえらびの立ち位置: 前庭の真ん中の手前（磯貝博士と離す）
    site.spot = env.W(-2, LAB.plaza + 1.5); site.face = env.W(-2, 0);
  }

  // ---------- 漁港: 渡し船と漁船 ----------
  const fleet = [];
  {
    const harbor = (q) => mask.get(q.x, q.z) & M.HARBOR || Math.hypot(q.x - 95, q.z - 30) < 30;
    const lines = data.V.coast.map((c) => resample(c.p, 3));
    const waterSide = (q) => {
      for (const s of [1, -1]) if (ground(q.x + q.nx * s * 6, q.z + q.nz * s * 6) < -0.8) return s;
      return 0;
    };
    // 船の下が水か（港は 1 m ほどと浅いので、竜骨の線がほぼ底に届かなければよい）
    const afloat = (it) => {
      const H = it.spec.hull;
      for (const lz of [-0.45, -0.2, 0.05, 0.3, 0.48]) for (const lx of [-0.5, 0, 0.5]) {
        const [x, , z] = boatPoint(it, lx * H.B, 0, lz * H.L);
        if (ground(x, z) > (lx ? -0.15 : lz > 0.3 ? -0.3 : -0.45)) return false;
      }
      return true;
    };
    // 岸の i 番目の点のまわりに横付けする: 船の長さぶんの弦で向きを決め、岸の出っ張りの外に出す
    const fit = (P, i, spec, flip, side = 0) => {
      const H = spec.hull, k = Math.ceil(H.L / 6);
      if (i - k < 0 || i + k >= P.length) return null;
      const q = P[i], s = side || waterSide(q);
      if (!s) return null;
      const a = P[i - k], b = P[i + k];
      let tx = b.x - a.x, tz = b.z - a.z;
      const l = Math.hypot(tx, tz);
      if (l < H.L * 0.8) return null;
      tx /= l; tz /= l;
      let nx = tz, nz = -tx;
      if (nx * q.nx * s + nz * q.nz * s < 0) { nx = -nx; nz = -nz; }
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      let bulge = -Infinity;
      for (let j = i - k; j <= i + k; j++) bulge = Math.max(bulge, (P[j].x - mx) * nx + (P[j].z - mz) * nz);
      const off = bulge + H.B / 2 + 0.5;
      const it = { spec, x: mx + nx * off, z: mz + nz * off, yaw: Math.atan2(tx, tz) + (flip ? Math.PI : 0), ph: 0, amp: 1 };
      if (fleet.some((o) => Math.hypot(o.x - it.x, o.z - it.z) < (o.spec.hull.L + H.L) / 2 + 1.0)) return null;
      if (!afloat(it)) return null;
      it.quay = { x: mx + nx * bulge, z: mz + nz * bulge, nx, nz };
      return it;
    };
    // 岸側の舷から、船首・船尾の舫い綱を岸のビットへ
    const moor = (it) => {
      const H = it.spec.hull, Q = it.quay;
      const side = Math.cos(it.yaw) * -Q.nx + Math.sin(it.yaw) * Q.nz > 0 ? 1 : -1;
      const fx = Math.sin(it.yaw), fz = Math.cos(it.yaw);
      for (const lz of [H.zb - 1.2, H.za + 0.45]) {
        const sec = H.section(lz);
        const a = boatPoint(it, side * (sec.hb - 0.08), sec.s + 0.05, lz);
        // 斜め前（後ろ）の岸の上: 陸に上がるまで内側へ探す
        const top = (x, z) => Math.max(ground(x, z), deck.at(x, z));
        for (let d = 0.6; d < 6; d += 0.4) {
          const bx = Q.x + fx * lz * 1.3 - Q.nx * d, bz = Q.z + fz * lz * 1.3 - Q.nz * d;
          if (top(bx, bz) < 0.5) continue;
          const bx2 = bx - Q.nx * 0.5, bz2 = bz - Q.nz * 0.5;
          mooring(kit, a, [bx2, top(bx2, bz2), bz2]);
          break;
        }
      }
    };
    // 渡し船: 待合所にいちばん近い、船が収まる岸
    const ferry = ferrySpec();
    const cand = [];
    lines.forEach((P, li) => P.forEach((q, i) => { if (harbor(q) && waterSide(q)) cand.push([Math.hypot(q.x - 95, q.z - 30), li, i]); }));
    cand.sort((a, b) => a[0] - b[0]);
    let fq = null;
    for (const [, li, i] of cand) {
      const it = fit(lines[li], i, ferry, false);
      if (!it) continue;
      fq = lines[li][i];
      it.amp = 0.4;
      fleet.push(it);
      moor(it);
      break;
    }
    if (fq) {
      const s = waterSide(fq);
      const [kx, kz] = [fq.x - fq.nx * s * 3, fq.z - fq.nz * s * 3];
      sign('アヒル島行 渡船のりば', { w: 1024, h: 150, bg: '#fdfcf6', fg: '#1b4f8a', border: '#1b4f8a', font: '900 88px "Zen Kaku Gothic New", sans-serif' }, 4.6, 0.68, kx, ground(kx, kz) + 2.3, kz, Math.atan2(-fq.nx * s, -fq.nz * s));
      for (const e of [-1.9, 1.9]) m.box(kx + fq.tx * e, ground(kx, kz) + 1.0, kz + fq.tz * e, 0.1, 2.0, 0.1, 0, C('#777'));
      PLACES.ferry.x = fq.x - fq.nx * s * 5; PLACES.ferry.z = fq.z - fq.nz * s * 5;
      { const vx = kx + fq.tx * 4, vz = kz + fq.tz * 4; vend(vx, vz, Math.atan2(fq.nx * s, fq.nz * s), 19, 1); }
    }
    // 漁船: 8 隻の仕様を順に試し、収まるものを間をあけて横付けする
    // 先に港の中の防波堤の内側（テトラポッドのない側）、次に岸壁
    const specs = Array.from({ length: 8 }, (_, i) => boatSpec(rng(300 + i * 13), i));
    const r = rng(5);
    const spots = [];
    for (const bw of data.V.breakwaters) {
      if (!bw.p.some(([x, z]) => mask.get(x, z) & M.HARBOR)) continue;
      const hw = bw.k === 'pier' ? 2 : 2.6;
      const P = resample(bw.p, 3).map((q) => ({ ...q, x: q.x - q.nx * hw, z: q.z - q.nz * hw }));
      spots.push([P, -1]);
    }
    for (const P of lines) spots.push([P, 0]);
    let n = 0;
    for (const [P, side] of spots) for (let i = 0; i < P.length; i++) {
      const q = P[i];
      if (!side && !harbor(q)) continue;
      if (fq && Math.hypot(q.x - fq.x, q.z - fq.z) < 24) continue;
      if (r() < 0.15) continue;
      const flip = r() < 0.5;
      for (let t = 0; t < specs.length; t++) {
        const it = fit(P, i, specs[(n + t) % specs.length], flip, side);
        if (!it) continue;
        it.ph = r() * 6;
        fleet.push(it);
        moor(it);
        n += t + 1;
        break;
      }
    }
  }
  const boats = buildFleet(fleet);
  group.add(boats);

  const mesh = new THREE.Mesh(m.build(), lambert({}, { amp: 0.08, scale: 0.9, key: 'landmark' }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.update = (t) => boats.userData.update(t);
  group.userData.sites = sites;
  return group;
}

const center = (p) => { const [a, b, c, d] = bbox(p); return [(a + c) / 2, (b + d) / 2]; };

function rail(m, x0, y0, z0, x1, y1, z1, th, col) {
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const g = new THREE.BoxGeometry(th, th, L);
  const mm = new THREE.Matrix4().lookAt(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x0, y0, z0), new THREE.Vector3(0, 1, 0));
  mm.setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.merge(g, mm, col);
}

function chainLink(fence) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(200,205,208,1)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(-32, 32); g.lineTo(0, 0); g.moveTo(64, 0); g.lineTo(96, 32); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const geos = [];
  for (const [x0, y0, z0, x1, y1, z1] of fence) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g2 = new THREE.PlaneGeometry(len, 1.8);
    const uv = g2.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 7, uv.getY(i) * 1.8 * 7);
    g2.translate(0, 0.95, 0);
    g2.rotateY(Math.atan2(z0 - z1, x1 - x0));
    g2.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    geos.push(g2);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, color: '#e6ecee' }));
  mesh.castShadow = true;
  return mesh;
}

function norenCanvas() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1f2f5c'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#f4f1ea'; g.font = '900 120px "Zen Kaku Gothic New", "Yu Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['め', 'し', '処'].forEach((ch, i) => g.fillText(ch, 90 + i * 166, 140));
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (const x of [170, 340]) g.fillRect(x - 3, 30, 6, 226);
  g.fillStyle = '#16213f'; g.fillRect(0, 0, 512, 26);
  return c;
}
