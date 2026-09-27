// 魚の手続き的モデル
// ・体は背・腹・幅の輪郭カーブから断面を積み上げて作る（左右に平たい断面、丸い吻端）
// ・口の切れ込み、鰓蓋の縁、眼窩のくぼみは形状に彫り、眼は虹彩と瞳をシェーダーで描く
// ・背鰭・臀鰭はトゲの先が膜から突き出し、膜はトゲの間で切れ込む。尾鰭・胸鰭・腹鰭は鰭条が扇状に開く
// ・鱗は頭側の鱗が尾側の鱗に重なる並びをシェーダーで描き（凹凸と縁の陰）、画素より細かくなると消す
// ・銀色の魚はテクスチャのα（銀の強さ）で水面の明るさを映し込む
// ・胸鰭は扇ぎ、背鰭・臀鰭の縁は波打つ（頂点シェーダー）
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';
import { patchMaterial } from '../core/shaderPatch.js';
import { lerp } from '../core/noise.js';
import { formOf, BODY_V, PART, finUV } from './fishform.js';
import { paintFishData } from './fishpaint.js';
import { SPECIES, DECOR_FISH } from './species.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ───────── ジオメトリ ─────────
const geoCache = new Map();
export function buildFishGeometry(sp, detail = 1) {
  const key = sp.id || sp.name;
  const ck = `${key}|${detail}`;
  if (geoCache.has(ck)) return geoCache.get(ck);
  const F = formOf(sp), S = F.S, bl = F.bl;
  const b = new GeoBuilder();
  const white = { r: 1, g: 1, b: 1 };
  // tiny: 群れで何千匹も泳ぐ飾りの小魚（鰭と眼は残して最小限に）
  const tiny = detail <= 0.22;
  const NU = Math.max(tiny ? 9 : 12, Math.round(60 * detail)), NV = tiny ? 8 : Math.max(10, Math.round(40 * detail / 2) * 2);

  // 胴体
  const body0 = b.count;
  const cols = [];
  for (let i = 0; i <= NU; i++) cols.push(bl * Math.pow(i / NU, 1.35));
  for (const X of cols) {
    for (let j = 0; j <= NV; j++) {
      const th = (j / NV) * Math.PI * 2;
      const s = F.sec(X, th);
      const side = s.sn >= 0 ? 1 : -1;
      const d = F.disp(X, s.y, side) * Math.sqrt(Math.abs(s.sn));
      const x = s.x + side * d;
      b.vert(V3(x, s.y, 0.5 - X), V3(s.sn, s.cs, 0), white, [X / bl, (j / NV) * BODY_V], { aBody: X, aFin: [0, 0, 0] });
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = body0 + i * (NV + 1) + j, c = a + NV + 1;
      b.quad(a, c, c + 1, a + 1);
    }
  }
  // 尾柄の蓋
  {
    const tp = F.top(bl), bt = F.bot(bl);
    const center = b.vert(V3(0, (tp + bt) / 2, 0.5 - bl), V3(0, 0, -1), white, [0.999, 0.5 * BODY_V], { aBody: bl, aFin: [0, 0, 0] });
    const ring = body0 + NU * (NV + 1);
    for (let j = 0; j < NV; j++) b.tri(center, ring + j + 1, ring + j);
  }
  const bodyEnd = b.count;

  // 背鰭・臀鰭
  const nT = tiny ? 1 : Math.max(2, Math.round(6 * detail));
  for (const [kind, sgn] of [['dorsal', 1], ['anal', -1]]) {
    const L = F.fins[kind];
    if (!L) continue;
    const part = PART[kind];
    for (const fin of L.fins) {
      let colsF = fin.cols;
      if (tiny) {
        // 小魚：輪郭がわかる程度の数列だけ
        const step = Math.max(1, Math.round(colsF.length / 4));
        colsF = colsF.filter((c, i) => i % step === 0 || i === colsF.length - 1);
      } else if (detail < 0.6) {
        // 遠景：トゲの切れ込みを残したまま列を間引く
        colsF = colsF.filter((c, i) => c.spine || i % 3 === 0 || i === colsF.length - 1);
      }
      const base = b.count;
      for (const c of colsF) {
        for (let k = 0; k <= nT; k++) {
          const t = k / nT;
          const p = F.unpairedPoint(fin, c, t, sgn);
          const ag = (lerp(fin.f.x0, fin.f.x1, c.a) - L.X0) / Math.max(L.X1 - L.X0, 1e-4);
          b.vert(V3(0, p.Y, 0.5 - p.X), V3(1, 0, 0), white, finUV(kind, ag, t), { aBody: p.X, aFin: [part, t, ag] });
        }
      }
      for (let i = 0; i < colsF.length - 1; i++) {
        for (let k = 0; k < nT; k++) {
          const a = base + i * (nT + 1) + k, c = a + nT + 1;
          b.quad(a, c, c + 1, a + 1);
        }
      }
    }
  }

  // 尾鰭
  if (S.caudal) {
    const nA = tiny ? 4 : Math.max(6, Math.round(22 * detail));
    const base = b.count;
    for (let i = 0; i <= nA; i++) {
      const a = i / nA;
      for (let k = 0; k <= nT; k++) {
        const t = k / nT;
        const p = F.caudalPoint(a, t);
        b.vert(V3(0, p.Y, 0.5 - p.X), V3(1, 0, 0), white, finUV('caudal', a, t), { aBody: p.X, aFin: [PART.caudal, t, 1 - 2 * a] });
      }
    }
    for (let i = 0; i < nA; i++) {
      for (let k = 0; k < nT; k++) {
        const a = base + i * (nT + 1) + k, c = a + nT + 1;
        b.quad(a, c, c + 1, a + 1);
      }
    }
  }

  // 胸鰭・腹鰭
  for (const kind of tiny ? ['pect'] : ['pect', 'pelv']) {
    const P = F.pairedSpec(kind);
    if (!P) continue;
    const nA = tiny ? 2 : Math.max(3, Math.round(12 * detail));
    const nR = tiny ? 1 : Math.max(2, Math.round(5 * detail));
    for (const side of [1, -1]) {
      const base = b.count;
      for (let i = 0; i <= nA; i++) {
        const a = i / nA;
        for (let k = 0; k <= nR; k++) {
          const t = k / nR;
          const p = F.pairedPoint(P, a, t, side);
          b.vert(V3(p.x, p.Y, 0.5 - p.X), V3(side, 0, 0), white, finUV(kind, a, t), { aBody: p.X, aFin: [P.part, t, side] });
        }
      }
      for (let i = 0; i < nA; i++) {
        for (let k = 0; k < nR; k++) {
          const a = base + i * (nR + 1) + k, c = a + nR + 1;
          b.quad(a, c, c + 1, a + 1);
        }
      }
    }
  }

  // 頭のトゲと皮弁（カサゴ）
  if (S.headSpines && detail > 0.5) {
    const cone = (X, Y, side, dir, len, rad) => {
      const g = new THREE.ConeGeometry(rad, len, 5, 1, true);
      g.translate(0, len / 2, 0);
      const x = F.surfX(X, Y) - rad * 0.5;
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(side * dir[0], dir[1], -dir[2]).normalize());
      const m = new THREE.Matrix4().compose(V3(side * x, Y, 0.5 - X), q, V3(1, 1, 1));
      const uv = [X / bl, ((side > 0 ? 0.25 : 0.75) + 0) * BODY_V];
      b.merge(g, m, () => white, () => ({ aBody: X, aFin: [0, 0, 0] }));
      // 色はその場所の体表から取る
      const n = g.attributes.position.count;
      for (let i = 0; i < n; i++) { b.uv[(b.count - n + i) * 2] = uv[0]; b.uv[(b.count - n + i) * 2 + 1] = uv[1]; }
    };
    const e = F.eyes[0];
    for (const side of [1, -1]) {
      // 前鰓蓋のトゲ（後ろ下向き）
      for (let k = 0; k < 5; k++) {
        const Y = e.Y - e.r * 1.4 - k * 0.018;
        const X = F.opX(Y, F.op[0]) - 0.03 + k * 0.004;
        cone(X, Y, side, [0.35, -0.25 - k * 0.1, -1], 0.018 - k * 0.002, 0.0035);
      }
      // 眼の上のトゲと皮弁
      cone(e.X - e.r * 0.3, e.Y + e.r * 1.15, side, [0.25, 1, -0.6], 0.016, 0.0035);
      cone(e.X + e.r * 0.8, e.Y + e.r * 1.0, side, [0.3, 1, -0.9], 0.014, 0.003);
      cone(e.X + e.r * 1.8, e.Y + e.r * 0.6, side, [0.3, 0.7, -1], 0.012, 0.003);
      // 鰓蓋のトゲ
      cone(F.op[0] + F.op[1] * 0.9, e.Y - e.r * 0.4, side, [0.2, 0.1, -1], 0.02, 0.004);
    }
  }

  // 眼（虹彩・瞳はシェーダーで描く。ここでは眼球の上の局所座標を渡す）
  const eSeg = detail > 0.6 ? 18 : tiny ? 6 : 8;
  for (const e of F.eyes) {
    const x = F.surfX(e.X, e.Y) - e.r * 0.3;
    const look = (S.flat ? V3(1, 0.1, 0.15) : V3(e.side, 0.05, 0.3)).normalize();
    const eu = V3(0, 1, 0).cross(look).normalize(); // 前後
    const ev = look.clone().cross(eu).normalize(); // 上下
    const sg = new THREE.SphereGeometry(e.r, eSeg, Math.round(eSeg * 0.7));
    const c = V3(e.side * x, e.Y, 0.5 - e.X);
    const p = sg.attributes.position;
    const base = b.count;
    for (let i = 0; i < p.count; i++) {
      const n = V3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const f = n.dot(look);
      const lu = f > 0 ? n.dot(eu) : 2, lv = f > 0 ? n.dot(ev) : 2;
      b.vert(c.clone().addScaledVector(n, e.r), n, white, [0.999, 0.999], { aBody: e.X, aFin: [PART.eye, lu / 0.93, lv / 0.93] });
    }
    const ix = sg.index.array;
    for (let i = 0; i < ix.length; i++) b.idx.push(base + ix[i]);
  }

  const geo = b.build();
  geo.deleteAttribute('color');
  geo.computeVertexNormals();
  // 背中の継ぎ目（v=0 と v=1）の法線をそろえる
  const nrm = geo.attributes.normal;
  for (let i = 0; i <= NU; i++) {
    const a = body0 + i * (NV + 1), c2 = a + NV;
    const nx = nrm.getX(a) + nrm.getX(c2), ny = nrm.getY(a) + nrm.getY(c2), nz = nrm.getZ(a) + nrm.getZ(c2);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(c2, nx / l, ny / l, nz / l);
  }
  geo.userData = { bodyEnd };
  geoCache.set(ck, geo);
  return geo;
}

// ───────── テクスチャ ─────────
// 塗りは重いので、起動時にワーカーで全魚種を並行して塗っておく（地形づくりと同時に進む）
const texData = new Map(); // 'S:id' / 'D:key' → {data, W, H}
const texKey = (sp) => (sp.id ? 'S:' + sp.id : 'D:' + Object.keys(DECOR_FISH).find((k) => DECOR_FISH[k] === sp));
let preparing = null;
export function prepareFishTextures() {
  if (preparing) return preparing;
  const jobs = [
    ...Object.values(SPECIES).filter((sp) => sp.shape).map((sp) => ({ key: 'S:' + sp.id, scale: sp.texScale ?? 1 })),
    ...Object.entries(DECOR_FISH).map(([k, d]) => ({ key: 'D:' + k, scale: d.texScale ?? 0.5 })),
  ];
  preparing = new Promise((resolve) => {
    let workers = [];
    try {
      const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
      for (let i = 0; i < n; i++) workers.push(new Worker(new URL('./fishpaint.worker.js', import.meta.url), { type: 'module' }));
    } catch (e) {
      workers.forEach((w) => w.terminate());
      resolve(); // ワーカーが使えなければ、必要になった時にその場で塗る
      return;
    }
    let left = jobs.length, next = 0;
    const finish = () => { workers.forEach((w) => w.terminate()); resolve(); };
    const give = (w) => {
      if (next >= jobs.length) return;
      w.postMessage(jobs[next++]);
    };
    for (const w of workers) {
      w.onmessage = (ev) => {
        const { key, data, W, H } = ev.data;
        texData.set(key, { data: new Uint8Array(data), W, H });
        if (--left === 0) finish(); else give(w);
      };
      w.onerror = () => { left = -1; finish(); };
      give(w);
    }
  });
  return preparing;
}

export function paintFishTexture(sp, scale = 1) {
  const pre = texData.get(texKey(sp));
  const { data, W, H } = pre || paintFishData(sp, scale);
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ───────── シェーダー ─────────
const swimCode = (PH, AMP, BEND, FOLD = '0.0') => /* glsl */ `
  {
    float bw = aBody * aBody * 0.95 + 0.04;
    transformed.x += sin(${PH} - aBody * uWave) * ${AMP} * bw + ${BEND} * aBody * aBody;
    float fp = aFin.x, ft = aFin.y;
    if (fp > 3.5 && fp < 5.5) {
      // 胸鰭・腹鰭：ゆっくり扇いで姿勢を保つ。陸に上げた魚は体に沿わせてたたむ
      float k = (fp < 4.5 ? 1.0 : 0.45) * (1.0 - ${FOLD});
      float ph = uTime * 3.9 + ${PH} * 0.17 + aFin.z * 0.9;
      transformed.x += aFin.z * ft * (0.004 + 0.011 * sin(ph)) * k;
      transformed.z += ft * 0.007 * cos(ph) * k;
      transformed.x *= 1.0 - ${FOLD} * 0.4 * ft;
    } else if (fp > 0.5 && fp < 3.5) {
      // 背鰭・臀鰭・尾鰭の縁が波打つ
      transformed.x += sin(uTime * 3.3 + aBody * 26.0 + ${PH} * 0.13) * ft * ft * 0.005;
    }
  }
`;
const FISH_SWAY = {
  single: {
    key: 'fish2s',
    decl: 'attribute float aBody; attribute vec3 aFin; uniform float uPhase; uniform float uAmp; uniform float uBend; uniform float uFold; uniform float uWave;',
    code: swimCode('uPhase', 'uAmp', 'uBend', 'uFold'),
  },
  inst: {
    key: 'fish2i',
    decl: 'attribute float aBody; attribute vec3 aFin; attribute vec3 iSwim; uniform float uWave;',
    code: swimCode('iSwim.x', 'iSwim.y', 'iSwim.z'),
  },
  swarm: {
    key: 'fish2w',
    decl: 'attribute float aBody; attribute vec3 aFin; attribute float aPhase; uniform float uWave;',
    code: swimCode('(uTime * 13.0 + aPhase)', '0.075', '0.0'),
  },
};

const FISH_FX = {
  key: 'fish2',
  vdecl: 'varying vec3 vFin;',
  vcode: 'vFin = aFin;',
  decl: /* glsl */ `
    varying vec3 vFin;
    uniform vec4 uScl;   // 鱗：体の長さ方向の数, 周方向の数, 強さ, 鱗の始まり（体の u）
    uniform vec3 uIris;
    uniform float uSheen;
    float fsH, fsK, fsSil, fsEdge;
    float fsHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  `,
  color: /* glsl */ `
    fsH = 0.0; fsK = 0.0; fsSil = 0.0; fsEdge = 0.0;
    {
      float part = vFin.x;
      #ifdef USE_MAP
        fsSil = texture2D(map, vMapUv).a;
      #endif
      if (part < 0.5) {
        #ifdef USE_MAP
        vec2 bu = vec2(vMapUv.x, vMapUv.y / ${BODY_V.toFixed(5)});
        vec2 g = bu * uScl.xy;
        float px = length(fwidth(g));
        fsK = uScl.z * smoothstep(uScl.w - 0.04, uScl.w + 0.08, bu.x) * (1.0 - smoothstep(0.25, 0.6, px));
        if (fsK > 0.001) {
          // 頭側の鱗が尾側の鱗に重なる：点を覆う鱗のうち、いちばん頭側のものが見える
          float by = floor(g.y);
          float bestX = 1e9, bd = 1.0;
          vec2 bid = vec2(0.0), bv = vec2(0.0);
          for (int j = -1; j <= 1; j++) {
            float ry = by + float(j);
            float off = 0.5 * mod(ry, 2.0);
            float bx = floor(g.x - off);
            for (int i = -1; i <= 1; i++) {
              vec2 c = vec2(bx + float(i) + 0.5 + off, ry + 0.5);
              c += (vec2(fsHash(c), fsHash(c + 7.1)) - 0.5) * vec2(0.14, 0.18);
              vec2 d = (g - c) / vec2(0.76, 0.7);
              float dl = dot(d, d);
              if (dl < 1.0 && c.x < bestX) { bestX = c.x; bd = sqrt(dl); bid = c; bv = d; }
            }
          }
          // 見えるのは鱗の後ろ側の縁（尾の方へ張り出す弧）だけ。上下の縁は隣の列に隠れる
          float post = smoothstep(-0.15, 0.55, bv.x / max(bd, 1e-3));
          fsEdge = smoothstep(0.72, 0.97, bd) * post;
          fsH = (1.0 - bd * bd) * 0.35 + (1.0 - smoothstep(0.8, 0.98, bd)) * smoothstep(0.5, 0.85, bd) * post * 0.65;
          float rnd = fsHash(bid);
          diffuseColor.rgb *= 1.0 + ((rnd - 0.5) * 0.14 - fsEdge * 0.16 + (1.0 - bd) * 0.03) * fsK;
          fsSil *= 1.0 + (rnd - 0.5) * 0.5 * fsK;
        }
        #endif
      } else if (part > 5.5) {
        // 眼：瞳・虹彩・黒い縁
        vec2 e = vFin.yz;
        float r = length(e);
        float ang = atan(e.y, e.x);
        float streak = 0.82 + 0.18 * sin(ang * 31.0 + sin(ang * 7.0) * 2.0);
        vec3 ic = uIris * streak * (0.7 + 0.45 * smoothstep(0.42, 0.8, r));
        ic = mix(ic, uIris * 1.5 + 0.08, smoothstep(0.08, 0.0, abs(r - 0.47)) * 0.6);
        vec3 c = mix(vec3(0.03, 0.03, 0.035), ic, 1.0 - smoothstep(0.86, 0.93, r));
        c = mix(c, vec3(0.004, 0.005, 0.008), 1.0 - smoothstep(0.39, 0.43, r));
        diffuseColor.rgb = c;
        fsSil = 0.0;
      }
      diffuseColor.rgb *= 1.0 - fsSil * 0.5;
    }
  `,
  normal: /* glsl */ `
    if (fsK > 0.001) {
      #ifdef USE_MAP
      vec3 sp = -vViewPosition;
      vec3 sx = dFdx(sp), sy = dFdy(sp);
      vec2 bu = vec2(vMapUv.x, vMapUv.y / ${BODY_V.toFixed(5)});
      float s2o = length(sx) / max(length(dFdx(bu * uScl.xy)), 1e-6);
      vec2 dH = vec2(dFdx(fsH), dFdy(fsH)) * 0.045 * s2o * fsK;
      vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
      float det = dot(sx, r1) * faceDirection;
      vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
      normal = normalize(abs(det) * normal - grad);
      #endif
    }
  `,
  rough: /* glsl */ `
    if (vFin.x > 5.5) { roughnessFactor = 0.1; metalnessFactor = 0.0; }
    else roughnessFactor = mix(roughnessFactor, 0.2, fsSil);
  `,
  light: /* glsl */ `
    {
      float part = vFin.x;
      vec3 ab = vWPos.y < 0.0 ? uwAbsorb(vWPos.y) : vec3(1.0);
      vec3 Ls = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
      if (part > 0.5 && part < 5.5) {
        // 鰭の膜は光を透かす
        float back = max(0.0, -dot(normal, Ls));
        reflectedLight.indirectDiffuse += diffuseColor.rgb * uSunCol * ab * (0.18 + back * 0.85) * (0.35 + 0.65 * vFin.y) * 0.55;
      }
      // 濡れたつや・銀の鏡面：水中なら上から明るく下へ暗くなる水の光、水上なら空を映す
      vec3 vdir = normalize(vViewPosition);
      vec3 rw = normalize((vec4(reflect(-vdir, normal), 0.0) * viewMatrix).xyz);
      vec3 env;
      if (vWPos.y < 0.0) {
        env = mix(uWaterDeep * 0.45, uWaterShallow * 1.3, smoothstep(-0.55, 0.75, rw.y));
        env += uSunCol * 0.7 * smoothstep(0.72, 1.0, rw.y) * exp(vWPos.y * 0.07);
        env *= mix(vec3(1.0), ab, 0.5);
      } else {
        env = skyColor(rw);
      }
      float fres = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 5.0);
      float refl = part > 5.5 ? 0.08 : mix((0.025 + 0.22 * fres) * uSheen, 0.85, fsSil) * (1.0 - fsEdge * 0.3 * fsK);
      reflectedLight.indirectSpecular += env * refl;
    }
  `,
};

/** variant: 'single'（1匹）/ 'inst'（まとめ描き）/ 'swarm'（装飾の小魚） */
export function makeFishMaterial(sp, tex, variant = 'single') {
  const uniforms = variant === 'single' ? { uPhase: { value: 0 }, uAmp: { value: 0.06 }, uBend: { value: 0 }, uFold: { value: 0 } } : {};
  const sc = sp.scales || [48, 36, 0.6];
  uniforms.uScl = { value: new THREE.Vector4(sc[0], sc[1], sc[2] ?? 0.6, sc[3] ?? (formOf(sp).op[0] + 0.01) / formOf(sp).bl) };
  uniforms.uIris = { value: new THREE.Color(sp.iris || '#c8b060') };
  uniforms.uSheen = { value: sp.sheen ?? 1 };
  uniforms.uWave = { value: sp.wave ?? 4.6 };
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: sp.rough ?? 0.42,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  patchMaterial(m, { sway: FISH_SWAY[variant], uniforms, fx: FISH_FX });
  m.userData.sw = uniforms;
  return m;
}

const assetCache = new Map();
export function fishAssets(sp) {
  if (!assetCache.has(sp)) {
    assetCache.set(sp, { geo: buildFishGeometry(sp, 1), far: buildFishGeometry(sp, 0.26), tex: paintFishTexture(sp, sp.texScale ?? 1) });
  }
  return assetCache.get(sp);
}

export function makeFishMesh(sp) {
  const { geo, tex } = fishAssets(sp);
  const mat = makeFishMaterial(sp, tex, 'single');
  const mesh = new THREE.Mesh(geo, mat);
  if (sp.flat) mesh.rotation.z = Math.PI / 2;
  const sw = { uPhase: mat.userData.sw.uPhase, uAmp: mat.userData.sw.uAmp, uBend: mat.userData.sw.uBend, uFold: mat.userData.sw.uFold };
  return { mesh, sw };
}
