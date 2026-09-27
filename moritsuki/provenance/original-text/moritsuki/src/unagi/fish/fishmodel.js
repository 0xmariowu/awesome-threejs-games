// 水路の魚の形と色（銛一本の魚の作り方を複製して、背骨にそって曲がる体にしたもの）
// ・体は背・腹・幅の輪郭カーブから断面を積み上げて作る。口の切れ込み・鰓蓋の縁・眼窩は形に彫る
// ・背鰭・尻鰭はトゲの先が膜から突き出し、尾鰭・胸鰭・腹鰭は鰭条が扇状に開く
// ・鱗・虹彩・瞳はシェーダーで描き、模様のテクスチャはワーカーで塗る（fishpaint.js）
// ・ひげ（ドジョウ・ナマズ）は細い管
// ・座標: 全長 = 1。aS = 吻端からの距離（背骨の位置）、x = 右、y = 上。吻端より前（ひげ）は z = 前へのはみ出し
import * as THREE from 'three';
import { GeoBuilder } from '../core/geo.js';
import { patchMaterial } from '../shade.js';
import { lerp } from '../core/noise.js';
import { formOf, BODY_V, PART, finUV } from './fishform.js';
import { paintFishData } from './fishpaint.js';
import { FISH } from './fishspecies.js';
import { DEFORM } from '../spine.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PART_BARBEL = 8;

// ───────── 形 ─────────
const geoCache = new Map();
export function buildFishGeometry(sp) {
  if (geoCache.has(sp.key)) return geoCache.get(sp.key);
  const F = formOf(sp), S = F.S, bl = F.bl;
  const b = new GeoBuilder();
  const white = { r: 1, g: 1, b: 1 };
  const long = bl / Math.max(...S.top.map((p) => p[1])) > 20;   // ウナギのように細長い体
  const NU = long ? 150 : 72, NV = 40;

  // 胴体
  const body0 = b.count;
  const cols = [];
  for (let i = 0; i <= NU; i++) cols.push(bl * Math.pow(i / NU, long ? 1.15 : 1.35));
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
  {
    const tp = F.top(bl), bt = F.bot(bl);
    const center = b.vert(V3(0, (tp + bt) / 2, 0.5 - bl), V3(0, 0, -1), white, [0.999, 0.5 * BODY_V], { aBody: bl, aFin: [0, 0, 0] });
    const ring = body0 + NU * (NV + 1);
    for (let j = 0; j < NV; j++) b.tri(center, ring + j + 1, ring + j);
  }

  // 背鰭・尻鰭
  const nT = 6;
  for (const [kind, sgn] of [['dorsal', 1], ['anal', -1]]) {
    const L = F.fins[kind];
    if (!L) continue;
    const part = PART[kind];
    for (const fin of L.fins) {
      let colsF = fin.cols;
      if (long) colsF = colsF.filter((c, i) => i % 2 === 0 || i === colsF.length - 1);
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
    const nA = 22;
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
  for (const kind of ['pect', 'pelv']) {
    const P = F.pairedSpec(kind);
    if (!P) continue;
    const nA = 12, nR = 5;
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

  // 眼（虹彩・瞳はシェーダーで描く。眼球の上の局所座標を渡す）
  for (const e of F.eyes) {
    const x = F.surfX(e.X, e.Y) - e.r * 0.3;
    const look = V3(e.side, 0.05, 0.3).normalize();
    const eu = V3(0, 1, 0).cross(look).normalize();
    const ev = look.clone().cross(eu).normalize();
    const sg = new THREE.SphereGeometry(e.r, 18, 13);
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

  // ひげ（左右に 1 本ずつ。先ほど細く、少し垂れる）
  for (const [X, Y, x, dir, len, r] of S.barbels || []) {
    for (const side of [1, -1]) {
      const d = V3(side * dir[0], dir[1], dir[2]).normalize();
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        // 模型の座標: z = 0.5 - X（前が +z）
        pts.push(V3(side * x, Y, 0.5 - X).addScaledVector(d, len * t).add(V3(0, -len * 0.3 * t * t, 0)));
      }
      b.tube(pts, (t) => r * (1 - t * 0.75), 5, () => white, (t) => ({ aBody: X, aFin: [PART_BARBEL, t, side] }));
    }
  }

  const geo = b.build();
  geo.deleteAttribute('color');
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i <= NU; i++) {
    const a = body0 + i * (NV + 1), c2 = a + NV;
    const nx = nrm.getX(a) + nrm.getX(c2), ny = nrm.getY(a) + nrm.getY(c2), nz = nrm.getZ(a) + nrm.getZ(c2);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(c2, nx / l, ny / l, nz / l);
  }
  // 背骨の座標へ: aS = 吻端からの距離、位置の z は吻端より前・尾より後ろへのはみ出しだけ
  const pos = geo.attributes.position;
  const aS = new Float32Array(pos.count), aPart = new Float32Array(pos.count);
  const fin = geo.attributes.aFin;
  for (let i = 0; i < pos.count; i++) {
    const X = 0.5 - pos.getZ(i);
    aS[i] = Math.min(1, Math.max(0, X));
    pos.setZ(i, X < 0 ? -X : X > 1 ? -(X - 1) : 0);
    aPart[i] = fin.getX(i);
  }
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  geo.setAttribute('aPart', new THREE.BufferAttribute(aPart, 1));
  // 背骨の枠（右 = 前×上、上、前）は鏡うつしになるので、三角形の向きを裏返しておく
  // （そのままだと外側の面が裏向きあつかいになり、法線が内へ向いて、ライトの当たる背中が暗くなる）
  const idx = geo.index;
  for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); }
  geo.computeBoundingSphere();
  geoCache.set(sp.key, geo);
  return geo;
}

/** 眼の中心（体の座標: s, 右, 上） */
export function fishEye(sp) {
  const F = formOf(sp);
  const e = F.eyes[0];
  return [e.X, F.surfX(e.X, e.Y) + e.r * 0.4, e.Y];
}

// ───────── テクスチャ（起動時にワーカーで塗る） ─────────
const texData = new Map();
let preparing = null;
export function prepareFishTextures() {
  if (preparing) return preparing;
  const jobs = Object.keys(FISH).map((key) => ({ key, scale: 1 }));
  preparing = new Promise((resolve) => {
    const workers = [];
    try {
      const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
      for (let i = 0; i < n; i++) workers.push(new Worker(new URL('./fishpaint.worker.js', import.meta.url), { type: 'module' }));
    } catch (e) {
      workers.forEach((w) => w.terminate());
      resolve();
      return;
    }
    let left = jobs.length, next = 0;
    const finish = () => { workers.forEach((w) => w.terminate()); resolve(); };
    const give = (w) => { if (next < jobs.length) w.postMessage(jobs[next++]); };
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
const texCache = new Map();
export function fishTexture(sp) {
  if (texCache.has(sp.key)) return texCache.get(sp.key);
  const { data, W, H } = texData.get(sp.key) || paintFishData(sp, 1);
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  texCache.set(sp.key, tex);
  return tex;
}

// ───────── 色（鱗・眼・鰭・ひげ）と、夜の光 ─────────
const FISH_DECL = /* glsl */ `
  varying vec3 vFin;
  uniform vec4 uScl;
  uniform vec3 uIris;
  uniform float uSheen;
  uniform vec3 uBarbel;
  float fsH, fsK, fsSil, fsEdge;
  float fsHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;
const FISH_COLOR = /* glsl */ `
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
        // 頭側の鱗が尾側の鱗に重なる
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
        float post = smoothstep(-0.15, 0.55, bv.x / max(bd, 1e-3));
        fsEdge = smoothstep(0.72, 0.97, bd) * post;
        fsH = (1.0 - bd * bd) * 0.35 + (1.0 - smoothstep(0.8, 0.98, bd)) * smoothstep(0.5, 0.85, bd) * post * 0.65;
        float rnd = fsHash(bid);
        diffuseColor.rgb *= 1.0 + ((rnd - 0.5) * 0.14 - fsEdge * 0.16 + (1.0 - bd) * 0.03) * fsK;
        fsSil *= 1.0 + (rnd - 0.5) * 0.5 * fsK;
      }
      #endif
    } else if (part > 5.5 && part < 6.5) {
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
    } else if (part > 7.5) {
      // ひげ: 根元は体の色に近く、先は淡い
      diffuseColor.rgb = uBarbel * (0.8 + 0.4 * vFin.y);
      fsSil = 0.0;
    }
    diffuseColor.rgb *= 1.0 - fsSil * 0.4;
  }
`;
const FISH_NORMAL = /* glsl */ `
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
`;
const FISH_ROUGH = /* glsl */ `
  if (vFin.x > 5.5 && vFin.x < 6.5) { roughnessFactor = 0.08; metalnessFactor = 0.0; }
  else {
    // 銀のうろこは鏡のようにライトを返す。ぬめりは細かいつや
    roughnessFactor = mix(roughnessFactor, 0.16, fsSil);
    metalnessFactor = fsSil * 0.75;
  }
`;
const FISH_LIGHT = /* glsl */ `
  {
    float part = vFin.x;
    float dl = length(vWPos - uLampPos);
    float irr = lampCone(vWPos) * uLampI / (dl * dl + 0.1) * clamp(pow(dl / 0.85, 3.6), 0.02, 1.0);
    float wd = ditchLevel(vWPos) - vWPos.y;
    vec3 ab = wd > 0.0 ? exp(-uWaterSigma * wd * 2.0) : vec3(1.0);
    if (part > 0.5 && part < 5.5) {
      // 鰭の膜はライトを透かす
      reflectedLight.directDiffuse += diffuseColor.rgb * irr * ab * (0.12 + 0.3 * vFin.y) * 0.25;
    }
    // ぬれた体のつや（ふちほど強い）
    vec3 vdir = normalize(vViewPosition);
    float fres = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 4.0);
    reflectedLight.indirectSpecular += vec3(0.02, 0.025, 0.035) * fres * uSheen * (1.0 + irr * 0.02);
  }
`;

/** 背骨の体の魚のマテリアル（SpineSet の makeMaterial に渡す） */
export function fishMaterialMaker(sp) {
  return ({ uniforms, vdecl, vnormal }) => {
    const F = formOf(sp);
    const sc = sp.scales || [48, 36, 0.6];
    Object.assign(uniforms, {
      uScl: { value: new THREE.Vector4(sc[0], sc[1], sc[2] ?? 0.6, sc[3] ?? (F.op[0] + 0.01) / F.bl) },
      uIris: { value: new THREE.Color(sp.iris || '#c8b060') },
      uSheen: { value: sp.sheen ?? 1 },
      uBarbel: { value: new THREE.Color(sp.shape.barbelCol || '#a09070') },
    });
    const m = new THREE.MeshStandardMaterial({ map: fishTexture(sp), roughness: sp.rough ?? 0.4, metalness: 0, side: THREE.DoubleSide });
    return patchMaterial(m, {
      uniforms,
      fx: {
        key: 'fishSpine-' + sp.key,
        vdecl: `${vdecl}\nattribute float aBody; attribute vec3 aFin; varying vec3 vFin;`,
        vnormal,
        vcode: /* glsl */ `
          vFin = aFin;
          vec3 lp = position;
          float fp = aFin.x, ft = aFin.y;
          if (fp > 3.5 && fp < 5.5) {
            // 胸鰭・腹鰭：ゆっくり扇ぐ
            float ph = uTime * 3.9 + aInst.z * 20.0 + aFin.z * 0.9;
            lp.x += aFin.z * ft * (0.004 + 0.011 * sin(ph)) * (fp < 4.5 ? 1.0 : 0.45);
            lp.z += ft * 0.006 * cos(ph);
          } else if (fp > 0.5 && fp < 3.5) {
            // 背鰭・尻鰭・尾鰭の縁が波打つ
            lp.x += sin(uTime * 3.3 + aBody * 26.0 + aInst.z * 13.0) * ft * ft * 0.004;
          } else if (fp > 7.5) {
            // ひげはゆらゆら
            lp.x += sin(uTime * 2.1 + aInst.z * 9.0 + aFin.z) * ft * ft * 0.02;
            lp.y += cos(uTime * 1.7 + aInst.z * 5.0) * ft * ft * 0.012;
          }
          transformed = spPos + (spR * lp.x + spUp * lp.y + spF * lp.z) * spL;
          if (aInst.w < 0.5) transformed = vec3(0.0, -50.0, 0.0);
        `,
        decl: FISH_DECL,
        color: FISH_COLOR,
        normal: FISH_NORMAL,
        rough: FISH_ROUGH,
        light: FISH_LIGHT,
      },
    });
  };
}

export { FISH, DEFORM };
