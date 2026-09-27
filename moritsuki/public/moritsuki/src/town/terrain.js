// 地形: 標高データから、細かい中心部と粗い外周の 2 枚を作る
// ・川と池を掘り、水面の高さを決める
// ・森は見た目だけ盛り上げて「こんもり」させる（当たり判定は地面の高さ）
import * as THREE from 'three';
import { pointInPoly, polylineDist, bbox, fbm2, vnoise } from './data.js';
import { classify, M, roadW, PAVED } from './layout.js';
import { lambert, paint } from './materials.js';
import { TEX } from './assets/textures.js';
import { forestness, landKind, smoothKinds, canopyLift } from './scenery/landscape.js';

// テクスチャの平均色（線形）: 色のむらだけを「細かさ」として乗せるため
export function texAvg(t) {
  const c = t.image, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 7) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); n++; }
  return new THREE.Vector3(r / n, gg / n, b / n);
}

const C = (h) => new THREE.Color(h);
const PAL = {
  sand: C('#ecdcaa'), wetSand: C('#cdbb8c'), seabed: C('#d4c393'), seabedDeep: C('#7e9a86'), rock: C('#8c8474'),
  town: C('#c4bca6'), townGrass: C('#9dbf5c'), grass: C('#8fc257'), grassDry: C('#b3c46a'),
  farm: C('#8dcc47'), farmDark: C('#6fae3a'), forest: C('#3e6d33'), forestLite: C('#679a42'), forestDark: C('#2c5429'),
  pitch: C('#d2b98d'), park: C('#96c463'), parking: C('#b1ab9b'), school: C('#93c25c'), cemetery: C('#a9a58f'), industrial: C('#bab4a3'),
  riverbed: C('#7c7a5e'), levee: C('#6f9d3a'), leveeDry: C('#8fa84c'), lawn: C('#86b94e'), lawnDark: C('#78ad45'),
};

export function carveWater(data, mask) {
  const { V, core } = data;
  const orig = core.h.slice();
  const level = new Float32Array(core.h.length).fill(NaN);
  const kindAt = new Uint8Array(core.h.length); // 1 川, 2 池, 3 小川
  const mark = (p, k, line) => {
    const [x0, z0, x1, z1] = bbox(p), m = line ? 2.5 : 0;
    const i0 = Math.max(0, Math.floor((x0 - m - core.x0) / core.step)), i1 = Math.min(core.nx - 1, Math.ceil((x1 + m - core.x0) / core.step));
    const j0 = Math.max(0, Math.floor((z0 - m - core.z0) / core.step)), j1 = Math.min(core.nz - 1, Math.ceil((z1 + m - core.z0) / core.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = core.xOf(i), z = core.zOf(j);
      if (line ? polylineDist(x, z, p) < 2.6 : pointInPoly(x, z, p)) if (!kindAt[j * core.nx + i]) kindAt[j * core.nx + i] = k;
    }
  };
  for (const w of V.water) mark(w.p, w.w === 'river' ? 1 : 2, false);
  for (const s of V.streams) mark(s.p, s.k === 'river' ? 1 : 3, true);
  // 橋のない舗装路が川を横切るところは暗渠（道の下を水が通る）: 掘らずに地面のまま渡れるようにする
  // （川に沿って水の中を走る道は横切りではないので、水の中の区間が短いときだけ）
  const cellAt = (x, z) => {
    const i = Math.round((x - core.x0) / core.step), j = Math.round((z - core.z0) / core.step);
    return i < 0 || j < 0 || i >= core.nx || j >= core.nz ? -1 : j * core.nx + i;
  };
  for (const r of V.roads) {
    if (r.br || !PAVED.has(r.k)) continue;
    const hw = roadW(r.k) / 2 + 0.6, S = [];
    for (let k = 0; k < r.p.length - 1; k++) {
      const [ax, az] = r.p[k], [bx, bz] = r.p[k + 1], L = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < L; t += 0.8) S.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]);
    }
    const wet = S.map(([x, z]) => { const c = cellAt(x, z); return c >= 0 && kindAt[c] ? 1 : 0; });
    for (let i = 0; i < S.length; i++) {
      if (!wet[i]) continue;
      let j = i;
      while (j + 1 < S.length && wet[j + 1]) j++;
      if ((j - i) * 0.8 <= 20) {
        for (let q = Math.max(0, i - 3); q <= Math.min(S.length - 1, j + 3); q++) {
          const [x, z] = S[q];
          const i0 = Math.round((x - hw - core.x0) / core.step), i1 = Math.round((x + hw - core.x0) / core.step);
          const j0 = Math.round((z - hw - core.z0) / core.step), j1 = Math.round((z + hw - core.z0) / core.step);
          for (let jj = Math.max(0, j0); jj <= Math.min(core.nz - 1, j1); jj++) for (let ii = Math.max(0, i0); ii <= Math.min(core.nx - 1, i1); ii++) {
            if (Math.hypot(core.xOf(ii) - x, core.zOf(jj) - z) <= hw) kindAt[jj * core.nx + ii] = 0;
          }
        }
      }
      i = j;
    }
  }
  const { nx, nz } = core;
  // 岸の高さから水面を決める
  const R = 3;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = kindAt[j * nx + i];
    if (!k) continue;
    let bank = Infinity;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || kindAt[jj * nx + ii]) continue;
      bank = Math.min(bank, orig[jj * nx + ii]);
    }
    if (!Number.isFinite(bank)) bank = orig[j * nx + i] + 1.5;
    const x = core.xOf(i), z = core.zOf(j);
    let dc = Infinity;
    for (const c of V.coast) if (c.p.length > 3) dc = Math.min(dc, polylineDist(x, z, c.p));
    const drop = k === 2 ? 0.7 : k === 3 ? 0.9 : 1.7;
    let lv = Math.max(0, bank - drop);
    lv *= THREE.MathUtils.smoothstep(dc, 12, 85);
    level[j * nx + i] = lv;
  }
  // 水面をならす
  for (let it = 0; it < 4; it++) {
    const nl = level.slice();
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const c = j * nx + i;
      if (!kindAt[c]) continue;
      let s = 0, n = 0;
      for (const d of [c, c - 1, c + 1, c - nx, c + nx]) if (kindAt[d]) { s += level[d]; n++; }
      nl[c] = s / n;
    }
    level.set(nl);
  }
  // 掘る
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i, k = kindAt[c];
    if (!k) continue;
    let inner = 0;
    for (const d of [c - 1, c + 1, c - nx, c + nx]) if (kindAt[d]) inner++;
    const depth = k === 3 ? 0.5 : 0.5 + inner * 0.3;
    core.h[c] = Math.min(core.h[c], level[c] - depth);
  }
  return { level, kindAt };
}

function slopeAt(g, i, j) {
  const dx = (g.get(i + 1, j) - g.get(i - 1, j)) / (2 * g.step), dz = (g.get(i, j + 1) - g.get(i, j - 1)) / (2 * g.step);
  return Math.hypot(dx, dz);
}

// 森の縁からの距離（セル数、最大 6）
function forestDist(forest, nx, nz) {
  const d = new Float32Array(nx * nz);
  for (let i = 0; i < d.length; i++) d[i] = forest[i] ? 99 : 0;
  const pass = (fwd) => {
    for (let jj = 0; jj < nz; jj++) for (let ii = 0; ii < nx; ii++) {
      const j = fwd ? jj : nz - 1 - jj, i = fwd ? ii : nx - 1 - ii, c = j * nx + i;
      if (!d[c]) continue;
      const s = fwd ? -1 : 1;
      const a = i + s >= 0 && i + s < nx ? d[c + s] + 1 : 1;
      const b = j + s >= 0 && j + s < nz ? d[c + s * nx] + 1 : 1;
      d[c] = Math.min(d[c], a, b);
    }
  };
  pass(true); pass(false);
  return d;
}

function areaKindAt(V, x, z) {
  for (const a of V.areas) {
    if (a.k === 'wood' || a.k === 'beach' || a.k === 'farm') continue;
    if (!a.bb) a.bb = bbox(a.p);
    const [x0, z0, x1, z1] = a.bb;
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    if (pointInPoly(x, z, a.p)) return a.k === 'pitch' && a.sf === 'grass' ? 'park' : a.k;
  }
  return null;
}

function colorFor(kind, x, z, h, slope, V, out) {
  const n = fbm2(x * 0.045, z * 0.045), n2 = vnoise(x * 0.3, z * 0.3);
  switch (kind) {
    case 'sea': {
      const t = THREE.MathUtils.clamp(-h / 8, 0, 1);
      out.copy(PAL.seabed).lerp(PAL.seabedDeep, t);
      if (slope > 0.5) out.lerp(PAL.rock, 0.6);
      break;
    }
    case 'water': out.copy(PAL.riverbed); break;
    case 'sand': out.copy(PAL.sand).lerp(PAL.wetSand, THREE.MathUtils.clamp(1 - h / 1.5, 0, 1) * 0.7); break;
    case 'ground': out.copy(PAL.town).lerp(PAL.townGrass, n2 > 0.72 ? 0.5 : 0); break;
    case 'lawn': out.copy(PAL.lawn).lerp(PAL.lawnDark, n * 0.6); break;
    case 'yard': out.copy(PAL.townGrass).lerp(PAL.town, THREE.MathUtils.smoothstep(n, 0.5, 0.72) * 0.6); break;
    case 'town': out.copy(PAL.townGrass).lerp(PAL.town, THREE.MathUtils.smoothstep(n, 0.45, 0.7) * 0.75).lerp(PAL.grassDry, n2 > 0.7 ? 0.35 : 0); break;
    case 'area': {
      const k = areaKindAt(V, x, z);
      out.copy(PAL[k] || PAL.town);
      break;
    }
    case 'farm': out.copy(PAL.farm).lerp(PAL.farmDark, n * 0.6).lerp(PAL.grassDry, n2 > 0.8 ? 0.4 : 0); break;
    case 'grass': out.copy(PAL.grass).lerp(PAL.grassDry, n * 0.7); break;
    // 田んぼの区画（scenery/paddies.js）の間のあぜ・草地
    case 'paddy': out.copy(PAL.levee).lerp(PAL.leveeDry, n2 * 0.5); break;
    case 'levee': out.copy(PAL.grass).lerp(PAL.levee, 0.6).lerp(PAL.grassDry, n * 0.4); break;
    default: {
      out.copy(PAL.forest).lerp(PAL.forestLite, THREE.MathUtils.smoothstep(n, 0.35, 0.75)).lerp(PAL.forestDark, n2 > 0.75 ? 0.35 : 0);
      if (slope > 0.9) out.lerp(PAL.rock, 0.55);
    }
  }
  return out;
}

function gridMesh(g, heightFn, colorFn, extraFn, skip) {
  const { nx, nz } = g;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), ex = new Float32Array(nx * nz * 3);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = g.xOf(i), z = g.zOf(j);
    pos[k * 3] = x; pos[k * 3 + 1] = heightFn(i, j, k); pos[k * 3 + 2] = z;
    colorFn(i, j, k, x, z, c);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    const e = extraFn ? extraFn(i, j, k) : [0, 0, 0];
    ex[k * 3] = e[0]; ex[k * 3 + 1] = e[1]; ex[k * 3 + 2] = e[2];
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (skip && skip(i, j)) continue;
    const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
    // 対角線は高さの差が小さい方で切る
    if (Math.abs(pos[a * 3 + 1] - pos[d * 3 + 1]) < Math.abs(pos[b * 3 + 1] - pos[cc * 3 + 1])) idx.push(a, cc, d, a, d, b);
    else idx.push(a, cc, b, b, cc, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSurf', new THREE.BufferAttribute(ex, 3));
  geo.setIndex(nx * nz > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// water は carveWater の結果（建物を並べたあとに色を決めるため、先に掘っておく）
export function buildTerrain(data, mask, water) {
  const { V, core, outer } = data;
  const { nx, nz } = core;
  // 地面の種類と森
  const kinds = new Array(nx * nz), slopes = new Float32Array(nx * nz), forest = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = core.xOf(i), z = core.zOf(j), h = core.h[k], s = slopeAt(core, i, j);
    slopes[k] = s;
    let kind = water.kindAt[k] ? 'water' : classify(x, z, h, s, mask);
    kinds[k] = kind;
  }
  // 町並みの外の森と田んぼの境目をならす
  const locked = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (mask.get(core.xOf(i), core.zOf(j)) & (M.TOWN | M.WOOD)) locked[j * nx + i] = 1;
  smoothKinds(kinds, nx, nz, locked);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    forest[k] = kinds[k] === 'forest' && !(mask.get(core.xOf(i), core.zOf(j)) & (M.ROAD | M.RAIL)) ? 1 : 0;
  }
  const fd = forestDist(forest, nx, nz);
  const canopy = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!forest[k]) continue;
    const x = core.xOf(i), z = core.zOf(j);
    canopy[k] = THREE.MathUtils.smoothstep(fd[k], 0.8, 5) * (5 + fbm2(x * 0.08, z * 0.08) * 7 + vnoise(x * 0.25, z * 0.25) * 2.5);
  }
  const coreGeo = gridMesh(core,
    (i, j, k) => core.h[k] + canopy[k],
    (i, j, k, x, z, c) => {
      colorFor(kinds[k], x, z, core.h[k], slopes[k], V, c);
      if (canopy[k] > 0) c.multiplyScalar(0.92 + Math.min(canopy[k], 12) * 0.018);
    },
    (i, j, k) => {
      const kd = kinds[k];
      const dirt = kd === 'town' ? 0.55 : kd === 'ground' || kd === 'area' ? 0.85 : kd === 'yard' ? 0.25 : kd === 'water' ? 0.9 : 0;
      const sand = kd === 'sand' || kd === 'sea' ? 1 : 0;
      // x: 森らしさ（樹冠のもこもこを描く）
      const calm = kd === 'paddy' || kd === 'levee' ? 2 : 0;
      return [(canopy[k] > 0 ? THREE.MathUtils.smoothstep(canopy[k], 0.5, 4) : 0) + calm, dirt, sand];
    });
  // 外周（中心部と重なるところは沈めて隠す）
  const outerGeo = gridMesh(outer,
    (i, j, k) => {
      const x = outer.xOf(i), z = outer.zOf(j), h = outer.h[k];
      // 中心部の下は中心部の地面より少し下に隠す（崖にならないように）
      if (core.inside(x, z, 1)) return core.at(x, z) - 1.5;
      // 森は見た目だけ盛り上げる（傾き・高さからの森らしさで、なめらかに）
      const f = forestness(h, slopeAt(outer, i, j));
      return h + canopyLift(f) * (6 + fbm2(x * 0.02, z * 0.02) * 9);
    },
    (i, j, k, x, z, c) => {
      const h = outer.h[k], s = slopeAt(outer, i, j);
      colorFor(h < 0.2 ? 'sea' : landKind(h, s), x, z, h, s, V, c);
    },
    (i, j, k) => {
      const h = outer.h[k];
      return [h < 0.2 ? 0 : forestness(h, slopeAt(outer, i, j)), 0, h < 0.2 ? 1 : 0];
    },
    (i, j) => core.inside(outer.xOf(i), outer.zOf(j), 30) && core.inside(outer.xOf(i + 1), outer.zOf(j + 1), 30));

  const tg = TEX.grassGround().map, td = TEX.dirt().map, ts = TEX.sand().map;
  const mat = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), {
    amp: 0.14, scale: 0.18, key: 'terrain2',
    uniforms: { tG: { value: tg }, tD: { value: td }, tS: { value: ts }, aG: { value: texAvg(tg) }, aD: { value: texAvg(td) }, aS: { value: texAvg(ts) } },
    fragHead: 'uniform sampler2D tG, tD, tS; uniform vec3 aG, aD, aS;',
    attrs: 'attribute vec3 aSurf;', vars: 'varying float vPaddy; varying float vCalm; varying vec2 vSurf;',
    vtx: 'vCalm = step(1.5, aSurf.x); vPaddy = aSurf.x - vCalm * 2.0; vSurf = aSurf.yz;',
    frag: /* glsl */ `
      {
        // 草・土・砂のテクスチャで細かいむらを足す（近くほど強く）
        float dist = length(cameraPosition - vWP);
        vec2 uv = vWP.xz / 3.0;
        vec3 dg = texture2D(tG, uv).rgb / aG, dd = texture2D(tD, uv).rgb / aD, ds = texture2D(tS, uv * 0.8).rgb / aS;
        vec3 det = mix(mix(dg, dd, clamp(vSurf.x, 0.0, 1.0)), ds, clamp(vSurf.y, 0.0, 1.0));
        diffuseColor.rgb *= mix(vec3(1.0), det, 0.9 * (1.0 - smoothstep(70.0, 260.0, dist)) * (1.0 - clamp(vPaddy, 0.0, 1.0) * 0.7) * (1.0 - vCalm * 0.65));
        // 水の中: 深さで赤から吸収され、青緑に沈む（銛一本と同じ考え方）
        float uw = max(-vWP.y + 0.1, 0.0);
        diffuseColor.rgb *= exp(-uw * vec3(0.32, 0.1, 0.07));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.26, 0.32), 1.0 - exp(-uw * 0.22));
      }
      {
        // 森（vPaddy = 森らしさ）: 樹冠のもこもこ。セルの中心ほど明るく、すき間は暗い。株ごとに色むら
        float fo = clamp(vPaddy, 0.0, 1.0);
        if (fo > 0.01) {
          vec2 p = vWP.xz / 4.2, ip = floor(p), fp = fract(p);
          float d1 = 8.0; vec2 cid = ip;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(tnH(ip + g), tnH(ip + g + 17.3));
            vec2 r = g + o - fp;
            float dd = dot(r, r);
            if (dd < d1) { d1 = dd; cid = ip + g; }
          }
          float crown = 1.0 - smoothstep(0.05, 0.8, d1);
          float far = smoothstep(250.0, 900.0, length(cameraPosition - vWP));
          diffuseColor.rgb *= mix(1.0, mix(0.58 + crown * 0.6, 0.9, far), fo);
          float tint = tnH(cid + 3.1);
          diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.82, 0.92, 0.85), vec3(1.2, 1.12, 0.8), tint), fo * 0.55);
        }
        // 草地の細かい斑点
        float sp = tnV(vWP.xz * 2.7);
        diffuseColor.rgb *= 1.0 + (sp - 0.5) * 0.08 * (1.0 - clamp(vPaddy, 0.0, 1.0));
      }`,
  });
  void lambert;
  const coreMesh = new THREE.Mesh(coreGeo, mat);
  coreMesh.receiveShadow = true;
  const outerMesh = new THREE.Mesh(outerGeo, mat);
  outerMesh.receiveShadow = false;
  return { coreMesh, outerMesh, water, kinds, forestDist: fd, canopy, slopes };
}

// 地面の高さ（当たり判定・配置用）
export function makeGround(data) {
  const { core, outer } = data;
  return (x, z) => (core.inside(x, z) ? core.at(x, z) : outer.at(x, z));
}
