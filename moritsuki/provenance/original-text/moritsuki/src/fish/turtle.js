// アオウミガメ（Chelonia mydas）の手続き的モデル
// ・甲羅は前が広いハート形のドーム。甲板（椎甲板5・肋甲板4対・縁甲板）をシェーダーで描く：継ぎ目の溝、成長輪、放射状の筋
// ・縁甲板は外へ少し反り、後ろ縁は鋸歯状。腹甲はクリーム色
// ・頭は短い吻と角質のくちばし、まぶた、鼻孔。頭・首・鰭の皮膚は淡い縁取りのある黒褐色の鱗
// ・前鰭は長い翼形で前縁に爪が1本、後ろ鰭は丸い櫂形。甲羅にはフジツボがいくつか付く
import * as THREE from 'three';
import { GeoBuilder, col } from '../core/geo.js';
import { patchMaterial } from '../core/shaderPatch.js';
import { RNG, makeNoise3D, smoothstep, clamp, lerp } from '../core/noise.js';
import { grid } from './lobster.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

// 部位: 0 甲羅, 1 腹甲, 2 皮膚, 3 眼, 4 くちばし, 5 フジツボ
const P = { SHELL: 0, PLAST: 1, SKIN: 2, EYE: 3, BEAK: 4, BARN: 5 };
const ex = (part, a = 0, b = 0, c = 0) => ({ aTu: [part, a, b, c] });
const C = {
  skin: col('#4a3e2c'),
  skinPale: col('#b8a67e'),
  belly: col('#d8cca0'),
  beak: col('#6e5a38'),
  eye: col('#120e0a'),
  barn: col('#c8c4b4'),
};
const mix = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

// ───────── 甲羅の形（上から見た輪郭とドーム） ─────────
const ZF = 0.5, ZB = -0.52;
function halfWidth(z) {
  const u = (z - ZB) / (ZF - ZB); // 0 後ろ → 1 前
  // 前寄りが最も広いハート形。後ろはすぼまり、前（首の上）は丸い
  let w = 0.4 * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1) * 0.94 + 0.06), 0.62) * (0.84 + 0.16 * smoothstep(0.1, 0.62, u));
  w *= 1 - 0.18 * smoothstep(0.82, 1, u);
  return Math.max(w, 0.004);
}
function domeY(s, z) {
  const u = (z - ZB) / (ZF - ZB);
  const H = 0.17 * (0.55 + 0.45 * Math.sin(Math.PI * clamp(u * 0.95 + 0.02, 0, 1))) * (1 - 0.25 * smoothstep(0.85, 1, u));
  const a = Math.abs(s);
  let y = H * Math.pow(Math.max(0, 1 - a * a), 0.78);
  // 縁甲板の反り（外縁の少し手前でわずかに持ち上がる）
  y += 0.01 * Math.exp(-(((a - 0.93) / 0.05) ** 2));
  return y + 0.018 * (1 - a);
}
const EDGE_Y = 0.012; // 甲羅の縁の高さ

// ───────── 甲羅と腹甲 ─────────
function buildShell(b, q, n3) {
  const nu = Math.round(72 * q) + 12, nv = Math.round(48 * q) + 10;
  // 後ろ縁の鋸歯
  const serr = (z, s) => {
    const u = (z - ZB) / (ZF - ZB);
    const back = 1 - smoothstep(0.1, 0.45, u);
    const ang = Math.atan2(s * halfWidth(z), z);
    return 1 - 0.035 * back * Math.pow(Math.abs(Math.sin(ang * 11)), 0.6);
  };
  // 上面：u は後ろ→前、v は右→左
  grid(b, nu, nv, false, (u, v) => {
    const z = lerp(ZB, ZF, u);
    const s = v * 2 - 1;
    const w = halfWidth(z) * serr(z, s);
    const p = V3(s * w, EDGE_Y + domeY(s, z), z);
    return { p, c: col('#ffffff'), ex: ex(P.SHELL, 1 - Math.abs(s), 0, 0), o: UP };
  });
  // 縁の厚み（上面の外周 → 下の縁）
  const ring = 160;
  const rimPt = (k, lower) => {
    const a = (k / ring) * Math.PI * 2;
    // 外周を u, s でたどる
    const z = lerp(ZB, ZF, 0.5 - 0.5 * Math.cos(a));
    const s = Math.sin(a) >= 0 ? 1 : -1;
    const w = halfWidth(z) * serr(z, s);
    const x = s * w;
    // 縁は薄く、下側は内へ引っ込む（甲羅が張り出して見える）
    return V3(x * (lower ? 0.93 : 1), lower ? 0.002 : EDGE_Y + domeY(s, z), z * (lower ? 0.97 : 1));
  };
  grid(b, ring, 1, false, (u, v) => {
    const k = Math.round(u * ring);
    const p = rimPt(k, v > 0.5);
    return { p, c: col('#ffffff'), ex: ex(P.SHELL, 0, 0, 0), o: V3(p.x, 0, p.z * 0.6) };
  });
  // 腹甲（少し小さく平たい）
  grid(b, Math.round(24 * q) + 6, Math.round(16 * q) + 6, false, (u, v) => {
    const z = lerp(ZB + 0.03, ZF - 0.02, u);
    const s = v * 2 - 1;
    const w = halfWidth(z) * 0.97;
    const p = V3(s * w, -0.004 - 0.028 * (1 - s * s) * Math.sin(Math.PI * u) * 0.9, z);
    return { p, c: C.belly, ex: ex(P.PLAST, 0, 0, 0), o: V3(0, -1, 0) };
  });
  void n3;
}

// 甲板の中心（上から見た x, z）。シェーダーの一様変数に渡す
const SCUTE_SEEDS = [
  // 椎甲板
  [0, 0.34], [0, 0.15], [0, -0.05], [0, -0.23], [0, -0.39],
  // 肋甲板
  [0.22, 0.27], [0.25, 0.06], [0.23, -0.14], [0.17, -0.31],
  [-0.22, 0.27], [-0.25, 0.06], [-0.23, -0.14], [-0.17, -0.31],
];

// ───────── 頭と首 ─────────
function buildHead(b, q) {
  // 首（甲羅の下から前へ）。原点は首の付け根
  const neckLen = 0.16;
  const nk = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; nk.push(V3(0, 0.01 + 0.03 * t, neckLen * t)); }
  grid(b, 10, Math.round(18 * q) + 6, true, (u, v) => {
    const i = Math.round(u * 10);
    const th = v * Math.PI * 2;
    const r = lerp(0.075, 0.056, u) * (1 + 0.06 * Math.sin(u * 40) * Math.sin(th * 3)); // しわ
    const d = V3(Math.sin(th) * 1.15, Math.cos(th) * 0.85, 0);
    const p = nk[i].clone().addScaledVector(d, r);
    const c = mix(C.skinPale, C.skin, smoothstep(-0.3, 0.6, Math.cos(th)) * 0.55);
    return { p, c, ex: ex(P.SKIN, 60, 0, 0), o: d };
  });
  // 頭：短く丸い吻、平たい頭頂
  const H0 = neckLen - 0.02, HL = 0.17;
  const headAt = (u, v) => {
    const z = H0 + u * HL;
    const th = v * Math.PI * 2;
    const env = Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.08, 0, 1)), 0.55) * (1 - 0.35 * smoothstep(0.55, 1, u));
    const w = 0.058 * env * (1 + 0.1 * smoothstep(0.2, 0.5, u));
    const h = 0.05 * env;
    const sx = Math.sin(th), sy = Math.cos(th);
    const x = w * Math.sign(sx) * Math.pow(Math.abs(sx), 0.8);
    let y = 0.045 + (sy > 0 ? h * Math.pow(sy, 0.75) : h * 1.05 * sy);
    y -= 0.012 * u * u; // 吻は少し下がる
    return { p: V3(x, y, z), sx, sy, u };
  };
  grid(b, Math.round(28 * q) + 8, Math.round(28 * q) + 8, true, (u, v) => {
    const r = headAt(u, v);
    // くちばし（吻の下半分と先）と口の線
    const beak = smoothstep(0.62, 0.8, r.u) * smoothstep(0.35, -0.2, r.sy) + smoothstep(0.86, 0.97, r.u) * 0.9;
    const mouth = Math.exp(-(((r.sy + 0.12 - (1 - r.u) * 0.5) / 0.06) ** 2)) * smoothstep(0.45, 0.7, r.u);
    let c = mix(C.skin, C.skinPale, smoothstep(0.1, -0.6, r.sy) * 0.7);
    c = mix(c, C.beak, clamp(beak, 0, 1));
    c = mix(c, col('#1a140c'), mouth * 0.85);
    return { p: r.p, c, ex: ex(beak > 0.5 ? P.BEAK : P.SKIN, 40, 0, 0), o: V3(r.sx, r.sy, 0) };
  });
  // 眼（まぶた付き）と鼻孔
  const eu = 0.52;
  for (const sd of [-1, 1]) {
    const r = headAt(eu, sd > 0 ? 0.3 : 0.7);
    const c = r.p.clone().add(V3(-sd * 0.006, 0.004, 0));
    const eye = new THREE.SphereGeometry(0.0145, q > 0.5 ? 14 : 8, q > 0.5 ? 10 : 6);
    b.merge(eye, new THREE.Matrix4().makeTranslation(c.x, c.y, c.z), () => C.eye, () => ex(P.EYE, sd, 0, 0));
    const lid = new THREE.TorusGeometry(0.0146, 0.005, 6, q > 0.5 ? 16 : 8);
    const m = new THREE.Matrix4().lookAt(V3(), V3(sd, 0.15, 0.25).normalize(), UP);
    m.setPosition(c.clone().add(V3(sd * 0.002, 0, 0)));
    b.merge(lid, m, () => mix(C.skin, C.skinPale, 0.25), () => ex(P.SKIN, 90, 0, 0));
    const nose = new THREE.SphereGeometry(0.004, 6, 4);
    const np = headAt(0.97, sd > 0 ? 0.06 : 0.94).p;
    b.merge(nose, new THREE.Matrix4().makeTranslation(np.x, np.y + 0.002, np.z - 0.004), () => col('#0c0906'), () => ex(P.EYE, 0, 0, 0));
  }
}

// ───────── 鰭 ─────────
/** 翼形の鰭。span は外向き（+x を side で反転）、chord は前後。原点は付け根 */
function buildFlipper(b, q, side, spec) {
  const { len, chord, sweep, thick, round } = spec;
  const nu = Math.round(22 * q) + 6, nv = Math.round(18 * q) + 6;
  const at = (u, v) => {
    // u: 付け根→先、v: 翼形の一周（0 前縁の上 → 後縁 → 前縁の下）
    const cU = chord * (round ? Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.2))) * (0.75 + 0.35 * Math.sin(Math.PI * u)) : (0.75 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.3)) * (1 - u * 0.6)) * Math.pow(1 - u, 0.35));
    const th = v * Math.PI * 2;
    const cx = 0.5 - 0.5 * Math.cos(th); // 前縁 0 → 後縁 1
    const t = thick * Math.pow(1 - u, 0.5) * 4 * Math.sqrt(cx) * (1 - cx) * 0.6;
    const y = Math.sin(th) >= 0 ? t : -t * 0.55;
    const x = side * len * u;
    // 前縁は前、後縁は後ろ。先ほど後ろへ流れる
    const z = -cx * cU + cU * 0.35 - sweep * u * u * len;
    return V3(x, y, z);
  };
  grid(b, nu, nv, true, (u, v) => {
    const p = at(u, v);
    const th = v * Math.PI * 2;
    const under = Math.sin(th) < 0;
    let c = under ? mix(C.skinPale, C.skin, 0.3) : C.skin;
    c = mix(c, C.skinPale, smoothstep(0.85, 1.0, 0.5 - 0.5 * Math.cos(th)) * 0.6); // 後縁は淡い
    return { p, c, ex: ex(P.SKIN, under ? 24 : 34, 0, 0), o: V3(0, Math.sin(th), -Math.cos(th) * 0.3) };
  });
  // 前縁の爪
  if (spec.claw && q > 0.5) {
    const cp = at(0.4, 0.0);
    const g = new THREE.ConeGeometry(0.008, 0.035, 6);
    g.translate(0, 0.0175, 0);
    const m = new THREE.Matrix4().compose(cp.clone().add(V3(0, 0.004, 0.004)), new THREE.Quaternion().setFromUnitVectors(UP, V3(side * 0.5, 0.15, 1).normalize()), V3(1, 1, 1));
    b.merge(g, m, () => col('#5a4a30'), () => ex(P.BEAK, 0, 0, 0));
  }
}

// ───────── フジツボ ─────────
function buildBarnacles(b, rng, q) {
  if (q < 0.5) return;
  const spots = [[0.12, -0.2], [0.16, -0.24], [0.1, -0.26], [-0.2, -0.05], [-0.05, 0.3]];
  for (const [x, z] of spots) {
    const r = rng.range(0.011, 0.018);
    const prof = [new THREE.Vector2(r * 0.35, r * 0.5), new THREE.Vector2(r * 0.55, r * 0.95), new THREE.Vector2(r * 0.8, r * 0.9), new THREE.Vector2(r * 1.05, 0.0)];
    const g = new THREE.LatheGeometry(prof, 7);
    const s = x / halfWidth(z);
    const y = EDGE_Y + domeY(s, z) - 0.002;
    const n = V3(-x * 0.6, 1, 0).normalize();
    const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromUnitVectors(UP, n), V3(1, 1, 1));
    b.merge(g, m, (v, vn, lp) => mix(col('#6a6458'), C.barn, lp.y / (r * 0.95)), () => ex(P.BARN, 0, 0, 0));
  }
}

// ───────── シェーダー ─────────
const TURTLE_FS = {
  key: 'turtle2',
  vdecl: 'attribute vec4 aTu; varying vec4 vTu; varying vec3 vTuP;',
  vcode: 'vTu = aTu; vTuP = position;',
  decl: /* glsl */ `
    varying vec4 vTu;
    varying vec3 vTuP;
    uniform vec2 uSeeds[${SCUTE_SEEDS.length}];
    float tuH, tuK;
    vec3 tuHash(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
      return fract(sin(p) * 43758.5453);
    }
    // 3Dのボロノイ：最寄りと2番目の距離
    vec3 tuCell(vec3 p) {
      vec3 ip = floor(p), fp = fract(p);
      float d1 = 8.0, d2 = 8.0, id = 0.0;
      for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 h = tuHash(ip + g);
        vec3 r = g + h * 0.8 + 0.1 - fp;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; id = h.y; } else if (d < d2) { d2 = d; }
      }
      return vec3(sqrt(d1), sqrt(d2), id);
    }
  `,
  color: /* glsl */ `
    tuH = 0.0; tuK = 0.0;
    {
      float part = vTu.x;
      float px = length(fwidth(vTuP));
      if (part < 0.5) {
        // 甲羅：縁甲板の帯と、内側の椎甲板・肋甲板
        vec2 q = vTuP.xz;
        float edge = vTu.y;            // 0 = 外縁
        float seam, ring, streak; float sid = 0.0;
        vec3 base;
        if (edge < 0.1) {
          // 縁甲板：外周の角度で区切る
          float a = atan(q.x, q.y + 0.02);
          float k = a / 6.2831 * 25.0;
          float f = fract(k);
          sid = floor(k);
          seam = min(f, 1.0 - f) * 0.45;
          seam = min(seam, abs(edge - 0.1) * 1.2);
          ring = fract(edge * 55.0);
          streak = 0.5 + 0.2 * sin(f * 6.0 + sid) + 0.15 * sin(edge * 90.0 + sid);
        } else {
          float d1 = 9.0, d2 = 9.0; vec2 c1 = vec2(0.0);
          for (int i = 0; i < ${SCUTE_SEEDS.length}; i++) {
            vec2 sdv = uSeeds[i];
            float d = distance(q, sdv);
            if (d < d1) { d2 = d1; d1 = d; c1 = sdv; sid = float(i); } else if (d < d2) { d2 = d; }
          }
          seam = (d2 - d1) * 0.5;
          seam = min(seam, (edge - 0.1) * 1.2);
          vec2 dv = q - c1;
          float ang = atan(dv.y, dv.x);
          // 成長点（後ろ寄り）からの同心の成長輪と放射状の筋
          ring = fract(length(dv - vec2(0.0, -0.03)) * 60.0);
          streak = 0.5 + 0.5 * sin(ang * 9.0 + sin(ang * 3.0 + sid) * 2.0 + sid * 1.7);
          streak *= 0.6 + 0.4 * sin(ang * 23.0 + sid);
        }
        // 色は線形空間（オリーブ褐色の地に、黒褐色と琥珀色の放射状の筋）
        base = mix(vec3(0.075, 0.056, 0.022), vec3(0.16, 0.11, 0.04), streak);
        base = mix(base, vec3(0.03, 0.022, 0.01), smoothstep(0.6, 1.0, streak) * 0.6);
        base = mix(base, vec3(0.3, 0.2, 0.07), smoothstep(0.8, 1.0, sin(streak * 17.0 + sid * 2.3)) * 0.35);
        base *= 0.96 + 0.06 * sin(ring * 6.2831) * (1.0 - smoothstep(0.002, 0.006, px));
        float sw = max(0.003, px * 1.2);
        float line = 1.0 - smoothstep(0.0, sw, seam);
        base = mix(base, vec3(0.34, 0.28, 0.15), line * 0.75);
        diffuseColor.rgb = base;
        tuH = smoothstep(0.0, 0.03, seam) * 0.8 + (0.5 + 0.5 * sin(ring * 6.2831)) * 0.08;
        tuK = 1.0 - smoothstep(0.004, 0.012, px);
      } else if (part < 1.5) {
        // 腹甲：中央と横の継ぎ目
        vec2 q = vTuP.xz;
        float s1 = abs(q.x);
        float s2 = abs(fract(q.y * 5.2 + 0.3) - 0.5) * 2.0;
        float l = max(1.0 - smoothstep(0.0, 0.006, s1), 1.0 - smoothstep(0.0, 0.05, s2) * 1.0);
        diffuseColor.rgb *= 1.0 - l * 0.2;
      } else if (part < 2.5 || part > 3.5 && part < 4.5) {
        // 皮膚とくちばし：淡い縁取りの鱗
        vec3 cc = tuCell(vTuP * vTu.y);
        float bord = cc.y - cc.x;
        float cw = max(0.06, px * vTu.y * 1.2);
        float line = 1.0 - smoothstep(0.0, cw, bord);
        vec3 sc = diffuseColor.rgb * (0.75 + 0.5 * cc.z);
        if (part < 2.5) diffuseColor.rgb = mix(sc, vec3(0.5, 0.42, 0.24), line * 0.75);
        else diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7, line * 0.4);
        tuH = smoothstep(0.0, 0.25, bord);
        tuK = (1.0 - smoothstep(0.08, 0.3, px * vTu.y)) * 0.8;
      } else if (part > 4.5) {
        diffuseColor.rgb *= 0.85 + 0.3 * fract(sin(dot(floor(vTuP * 300.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      }
    }
  `,
  normal: /* glsl */ `
    if (tuK > 0.001) {
      vec3 sp = -vViewPosition;
      vec3 sx = dFdx(sp), sy = dFdy(sp);
      float s2o = length(sx) / max(length(dFdx(vTuP)), 1e-7);
      float amp = vTu.x < 0.5 ? 0.004 : 0.0025;
      vec2 dH = vec2(dFdx(tuH), dFdy(tuH)) * amp * s2o * tuK;
      vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
      float det = dot(sx, r1) * faceDirection;
      vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
      normal = normalize(abs(det) * normal - grad);
    }
  `,
  rough: /* glsl */ `
    if (vTu.x > 2.5 && vTu.x < 3.5) roughnessFactor = 0.08;
    else if (vTu.x < 0.5) roughnessFactor = 0.42;
  `,
};

let mat = null;
function turtleMaterial() {
  if (mat) return mat;
  mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
  patchMaterial(mat, { uniforms: { uSeeds: { value: SCUTE_SEEDS.map(([x, z]) => new THREE.Vector2(x, z)) } }, fx: TURTLE_FS });
  return mat;
}
const build = (fn) => {
  const b = new GeoBuilder();
  fn(b);
  const g = b.build();
  g.deleteAttribute('uv');
  return g;
};

/** Turtle クラスが鰭の付け根（pivot）と頭を回して泳がせる */
export function makeTurtle() {
  const group = new THREE.Group();
  const m = turtleMaterial();
  const n3 = makeNoise3D(12);
  const rng = new RNG(5);
  group.add(new THREE.Mesh(build((b) => { buildShell(b, 1, n3); buildBarnacles(b, rng, 1); }), m));
  // 尾
  const tail = new THREE.Mesh(build((b) => {
    const g = new THREE.ConeGeometry(0.03, 0.09, 8);
    g.rotateX(-Math.PI / 2);
    b.merge(g, new THREE.Matrix4().makeTranslation(0, -0.005, ZB - 0.02), () => C.skin, () => ex(P.SKIN, 40, 0, 0));
  }), m);
  group.add(tail);
  // 頭（首の付け根を支点に振る）
  const head = new THREE.Group();
  head.position.set(0, 0.0, ZF - 0.12);
  head.add(new THREE.Mesh(build((b) => buildHead(b, 1)), m));
  group.add(head);
  // 鰭
  const flippers = [];
  const mkFlip = (side, x, z, front) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * x, 0.012, z);
    const spec = front
      ? { len: 0.6, chord: 0.17, sweep: 0.28, thick: 0.03, round: false, claw: true }
      : { len: 0.25, chord: 0.17, sweep: 0.12, thick: 0.028, round: true, claw: false };
    const f = new THREE.Mesh(build((b) => buildFlipper(b, 1, side, spec)), m);
    f.rotation.y = side * (front ? 0.3 : 0.55);
    pivot.add(f);
    group.add(pivot);
    flippers.push({ pivot, front, side });
  };
  mkFlip(1, 0.24, 0.24, true);
  mkFlip(-1, 0.24, 0.24, true);
  mkFlip(1, 0.18, -0.38, false);
  mkFlip(-1, 0.18, -0.38, false);
  group.userData.flippers = flippers;
  group.userData.head = head;
  return group;
}
