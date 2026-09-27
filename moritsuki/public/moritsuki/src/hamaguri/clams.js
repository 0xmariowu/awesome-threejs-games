// 貝・石・流木のモデル（実寸。1 個ずつ模様がちがう）
// 二枚貝: 殻頂（umbo）から縁へ、縁の形を相似に広げた「成長線」で殻を張る。s = 殻頂からの成長（0..1）、u = 縁のまわりの位置
//   模様（放射状の帯・ジグザグ・成長線・殻頂の色）はシェーダーで s, u から描く
// 巻き貝: 対数らせんの管（ナガラミ = 平たいこま形、ツメタガイ = 丸い）
// モデルのローカル座標: +y = 背（ちょうつがい）、+x = 後ろ（水管の側）、z = 殻の厚み。原点 = 殻の中心
import * as THREE from 'three';
import { patchMaterial } from './shade.js';
import { RNG, makeNoise3D, clamp, lerp, smoothstep } from './core/noise.js';
import { SHELLS } from './species.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// 形のパラメータ（長さ 1 に対して）
const FORM = {
  honhama: { hr: 0.8, ux: -0.07, tri: 0.3, post: 0.03, D: 0.235, ridge: 0.0 },
  chosen: { hr: 0.76, ux: -0.1, tri: 0.27, post: 0.08, D: 0.25, ridge: 0.0015 },
  bakagai: { hr: 0.8, ux: -0.02, tri: 0.3, post: 0.0, D: 0.25, ridge: 0.001 },
  kara: { hr: 0.8, ux: -0.07, tri: 0.3, post: 0.03, D: 0.23, ridge: 0.0 },
};

/** 縁の形（u: 0..1、0.25 = 背のてっぺん（殻頂の上）、0.75 = 腹の縁） */
function outline(f, u) {
  const phi = u * Math.PI * 2;
  const a = 0.5, b = f.hr / 2;
  let x = a * Math.cos(phi), y = b * Math.sin(phi);
  // 背の側を三角に絞る
  const up = Math.max(0, Math.sin(phi));
  x = f.ux + (x - f.ux) * (1 - f.tri * up * up);
  // 後ろ（+x）をすこし伸ばす
  if (x > 0) x *= 1 + f.post * (1 - up);
  // 腹の縁はゆるく丸く
  y *= 1 - 0.04 * Math.max(0, -Math.sin(phi)) * Math.cos(phi * 2);
  return [x, y];
}

/** 二枚貝の殻（片側 1 枚）。side = +1 / -1（z の向き） */
function valveGeo(f, side, rng, NU = 76, NS = 30) {
  const umbo = outline(f, 0.25);
  const U = [umbo[0] - 0.03, umbo[1] * 0.8];
  const pos = [], sh = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    for (let j = 0; j <= NU; j++) {
      const u = j / NU;
      const o = outline(f, u);
      const x = U[0] + (o[0] - U[0]) * s, y = U[1] + (o[1] - U[1]) * s;
      // ふくらみ: 殻頂のすこし下がいちばん高く、縁でゼロ
      let z = f.D * Math.pow(Math.max(0, 1 - Math.pow(s, 2.3)), 0.58);
      // 背の縁（殻頂の前後）は低く
      const dors = Math.max(0, Math.sin(u * Math.PI * 2));
      z *= 1 - 0.25 * dors * dors * smoothstep(0.3, 1, s);
      // 成長の段
      if (f.ridge) z += f.ridge * Math.sin(s * 70 + rng.range(0, 0.001)) * s;
      z = Math.max(z, 0.0015 * (1 - s));
      pos.push(x, y, z * side);
      sh.push(s, u, side);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NU; j++) {
    const a = i * (NU + 1) + j, b = a + 1, c = a + NU + 1, d = c + 1;
    if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aShell', new THREE.Float32BufferAttribute(sh, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ───────── 二枚貝の模様（シェーダー） ─────────
const SHELL_FX = {
  key: 'shell',
  vdecl: 'attribute vec3 aShell; varying vec3 vShell; varying vec3 vOPos;',
  vcode: 'vShell = aShell; vOPos = position;',
  decl: /* glsl */ `
    varying vec3 vShell; varying vec3 vOPos;
    uniform float uSeed;
    uniform int uPat;       // 0 本ハマグリ 1 チョウセン 2 バカガイ 3 空き殻 4 主（本） 5 主（チョウセン）
    uniform vec3 uBase; uniform vec3 uInk; uniform vec3 uUmbo;
    uniform vec4 uHole;     // 空き殻の丸い穴（ローカル xyz, 半径）
    uniform float uWet;
    float sh_n(vec2 p) { return hm_vn(p + uSeed * 17.0); }
  `,
  color: /* glsl */ `
    {
      if (uHole.w > 0.0 && length(vOPos - uHole.xyz) < uHole.w) discard;
      float s = vShell.x, u = vShell.y;
      // 殻頂から見た放射の角度（u）と、成長（s）
      vec3 col = uBase;
      float grow = s;
      // 成長線: 細かい段と、ときどき濃い冬の輪
      float rings = sin(grow * 180.0 + sh_n(vec2(u * 30.0, 0.0)) * 2.0) * 0.5 + 0.5;
      float winter = smoothstep(0.93, 1.0, sin(grow * 23.0 + uSeed * 6.0) * 0.5 + 0.5);
      if (uPat == 0 || uPat == 4) {
        // 本ハマグリ: 深い黒茶が基調。うっすら茶色い成長の縞、ときどき淡い放射の筋や、殻頂の白っぽい地に山形の模様
        vec3 black = vec3(0.009, 0.0065, 0.0055), brown = vec3(0.06, 0.03, 0.018), olive = vec3(0.05, 0.042, 0.028);
        vec3 cream = vec3(0.56, 0.47, 0.31), ink = vec3(0.045, 0.018, 0.009);
        float kind = fract(uSeed * 7.13);
        // 成長の縞（細い段と、ところどころ太い茶の帯）
        float band = smoothstep(0.35, 0.95, sin(grow * 26.0 + sh_n(vec2(u * 5.0, grow * 3.0)) * 2.2 + uSeed * 9.0) * 0.5 + 0.5);
        col = mix(black, brown, band * 0.5 * smoothstep(0.1, 0.9, sh_n(vec2(u * 3.0, grow * 1.5)) + 0.35) + rings * 0.08);
        // 腹の縁へ行くほど茶色がかって、細い成長線が見える
        col = mix(col, brown * (0.9 + rings * 0.5), smoothstep(0.55, 0.95, grow) * 0.45);
        // 殻の前後のふち寄りは少しオリーブがかる
        float side = smoothstep(0.16, 0.0, abs(u - 0.5)) + smoothstep(0.12, 0.0, min(u, 1.0 - u));
        col = mix(col, olive, clamp(side, 0.0, 1.0) * smoothstep(0.3, 0.8, grow) * 0.45);
        // 淡い放射の筋（1〜2 本）
        if (kind > 0.55 && kind < 0.86) {
          float ray = 0.0;
          for (int k = 0; k < 2; k++) {
            float c = 0.58 + fract(uSeed * (3.1 + float(k) * 1.9)) * 0.34;
            float w = 0.005 + fract(uSeed * (5.3 + float(k))) * 0.012;
            ray = max(ray, 1.0 - smoothstep(w * 0.4, w, abs(u - c)));
          }
          ray *= smoothstep(0.08, 0.3, grow) * (0.5 + 0.5 * band);
          col = mix(col, mix(cream, vec3(0.12, 0.07, 0.04), 0.6), ray * 0.7);
        }
        // 殻頂の白っぽい地に、黒茶の山形（テント）模様が広がる個体
        float light = kind > 0.95 ? 1.0 : kind > 0.88 ? 1.0 - smoothstep(0.15, 0.45, grow + sh_n(vec2(u * 7.0, 1.0)) * 0.2) : 0.0;
        if (light > 0.0) {
          // 細かい不規則な山形（ジグザグ）の線と、ところどころ濃い帯
          vec2 wq = vec2(u * 30.0 + sh_n(vec2(u * 6.0, grow * 4.0)) * 9.0, grow * 10.0 + sh_n(vec2(u * 9.0, grow * 2.0)) * 3.0);
          float zz = abs(fract(wq.x * 0.5 + abs(fract(wq.y) - 0.5) * 1.3) - 0.5) * 2.0;
          float tent = smoothstep(0.42, 0.56, zz) * smoothstep(0.3, 0.6, sh_n(vec2(u * 7.0, grow * 6.0)) + 0.2);
          float dband = smoothstep(0.55, 0.8, sh_n(vec2(u * 2.0, grow * 7.0)));
          vec3 lc = mix(cream, ink, max(tent * 0.85, dband * 0.7));
          lc = mix(lc, black, smoothstep(0.8, 1.0, grow) * 0.7);
          col = mix(col, lc, light);
        }
        col = mix(col, black * 0.7, winter * 0.4);
        if (uPat == 4) {
          // 主: 深い年輪と、金色にひかる帯
          float yr = smoothstep(0.7, 1.0, sin(grow * 48.0) * 0.5 + 0.5);
          col = mix(col, black * 0.6, yr * 0.5);
          col += vec3(0.16, 0.09, 0.015) * smoothstep(0.96, 1.0, sin(grow * 48.0 + 1.3) * 0.5 + 0.5);
        }
      } else if (uPat == 1 || uPat == 5) {
        // チョウセンハマグリ: 白い地に、殻頂から腹へ赤茶の扇。扇は同心の縞で途切れ、細い放射の筋が入る。前後のふちは黒紫
        vec3 white = vec3(0.72, 0.66, 0.58), red = vec3(0.085, 0.017, 0.011), redL = vec3(0.16, 0.055, 0.035), dusk = vec3(0.022, 0.016, 0.02);
        col = white * (0.95 + rings * 0.05);
        float cu = 0.73 + (fract(uSeed * 5.7) - 0.5) * 0.08;
        float hw = 0.075 + grow * 0.1 + fract(uSeed * 2.3) * 0.03;
        float edgeN = (sh_n(vec2(grow * 9.0, u * 3.0)) - 0.5) * 0.05 + (sh_n(vec2(grow * 40.0, u * 7.0)) - 0.5) * 0.025;
        float wedge = 1.0 - smoothstep(hw * 0.9, hw * 1.02, abs(u - cu + edgeN));
        // 同心の縞: 殻頂の近くは濃くつながり、腹へ行くほど白い段で途切れる
        float cband = sin(grow * 30.0 + sh_n(vec2(u * 4.0, grow * 2.0)) * 1.8 + uSeed * 4.0) * 0.5 + 0.5;
        float broken = mix(1.0, 0.2 + 0.8 * smoothstep(0.04, 0.22, cband), smoothstep(0.38, 0.7, grow));
        float wAmt = wedge * broken * smoothstep(0.02, 0.1, grow);
        vec3 wc = mix(red, redL, smoothstep(0.2, 0.9, grow));
        // 扇の中の細い放射の筋（格子っぽく見える）
        float fine = smoothstep(0.7, 0.95, sin(u * 700.0 + sh_n(vec2(u * 40.0, grow * 6.0)) * 4.0) * 0.5 + 0.5) * smoothstep(0.4, 0.85, grow);
        wc = mix(wc, white * 0.6, fine * 0.18);
        // 扇の中の細い同心の線
        wc *= 0.85 + 0.15 * smoothstep(0.3, 0.7, sin(grow * 160.0) * 0.5 + 0.5);
        col = mix(col, wc, wAmt);
        // 前後のふち（殻の左右の斜面）は黒紫のかげ
        float sideA = smoothstep(0.19, 0.05, abs(u - 0.46) + (sh_n(vec2(grow * 5.0, 3.0)) - 0.5) * 0.05) * smoothstep(0.05, 0.3, grow);
        float sideP = smoothstep(0.11, 0.02, min(abs(u - 0.03), abs(u - 1.03))) * smoothstep(0.15, 0.45, grow);
        col = mix(col, dusk, clamp(max(sideA, sideP), 0.0, 1.0) * 0.92);
        // 腹の縁ぞいの茶色い細い縞
        col = mix(col, vec3(0.1, 0.045, 0.04), smoothstep(0.88, 0.97, grow) * smoothstep(0.4, 0.8, cband) * 0.6);
        if (uPat == 5) {
          float yr = smoothstep(0.75, 1.0, sin(grow * 40.0) * 0.5 + 0.5);
          col = mix(col, red * 0.8, yr * 0.35);
          col += vec3(0.07, 0.045, 0.01) * smoothstep(0.95, 1.0, sin(grow * 40.0 + 1.0) * 0.5 + 0.5);
        }
      } else if (uPat == 2) {
        // バカガイ: 黄土色の皮に、殻頂から淡い放射。成長線がはっきり
        float rays = smoothstep(0.6, 0.9, sin(u * 90.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.2, 0.7, grow));
        col = mix(col, vec3(0.86, 0.8, 0.72), rays * 0.5);
        col *= 0.86 + rings * 0.14;
        col = mix(col, uInk, winter * 0.5);
      } else {
        // 空き殻: 日に焼けて白っぽく、模様がうっすら
        float ghost = smoothstep(0.55, 0.8, sh_n(vec2(u * 12.0, grow * 3.0)));
        col = mix(col, uInk, ghost * 0.25);
        col *= 0.92 + rings * 0.08;
      }
      // 殻頂は色が濃い（すり減って白いことも）
      float um = 1.0 - smoothstep(0.0, 0.22, grow);
      if (uPat == 1 || uPat == 5) col = mix(col, vec3(0.68, 0.64, 0.58), (1.0 - smoothstep(0.0, 0.06, grow)) * 0.9);
      else if (uPat != 0 && uPat != 4) col = mix(col, uUmbo, um * 0.75);
      // 縁: 二枚が合わさる所の細い線
      col *= 1.0 - smoothstep(0.965, 1.0, grow) * 0.45;
      // 内側（空き殻の裏）: 白い陶器のような面と、紫の貝柱の跡
      if (!gl_FrontFacing) {
        col = vec3(0.93, 0.91, 0.87);
        float scar = 1.0 - smoothstep(0.05, 0.07, length(vec2((u - 0.47) * 3.0, grow - 0.62)));
        scar = max(scar, 1.0 - smoothstep(0.05, 0.07, length(vec2((u - 0.03) * 3.0, grow - 0.62))));
        col = mix(col, vec3(0.62, 0.5, 0.64), scar * 0.6);
        col = mix(col, vec3(0.55, 0.45, 0.6), smoothstep(0.9, 1.0, grow) * 0.5);
      }
      diffuseColor.rgb = col;
    }`,
  rough: /* glsl */ `
    roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, uWet);
  `,
};

function shellMaterial(pat, cols, seed, o = {}) {
  const uniforms = {
    uSeed: { value: seed }, uPat: { value: pat },
    uBase: { value: new THREE.Color(cols.base) }, uInk: { value: new THREE.Color(cols.ink) }, uUmbo: { value: new THREE.Color(cols.umbo) },
    uHole: { value: new THREE.Vector4(0, 0, 0, 0) }, uWet: { value: 1 },
  };
  const m = new THREE.MeshPhysicalMaterial({
    roughness: o.rough ?? 0.42, clearcoat: o.coat ?? 0.6, clearcoatRoughness: o.coatRough ?? 0.18, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
  });
  patchMaterial(m, { fx: SHELL_FX, uniforms });
  m.userData.u = uniforms;
  return m;
}

// 本ハマグリ・チョウセンハマグリの色はシェーダーの中で決める（この値は使わない）
const HAMA_COLS = [{ base: '#000000', ink: '#000000', umbo: '#000000' }];

/** 二枚貝（閉じた 2 枚。kara = 片側だけの空き殻） */
function makeBivalve(id, cm, seed) {
  const sp = SHELLS[id];
  const formId = sp.model || id;
  const f = { ...FORM[formId] };
  const rng = new RNG(Math.floor(seed * 99991) + 7);
  // 個体差: 高さ・ふくらみ
  f.hr *= rng.range(0.96, 1.04);
  f.D *= rng.range(0.93, 1.07);
  const L = cm / 100;
  const group = new THREE.Group();
  let pat = 0, cols, coat = 0.6, rough = 0.4;
  if (formId === 'honhama') { pat = sp.legend ? 4 : 0; cols = HAMA_COLS[0]; coat = 0.75; rough = 0.45; }
  else if (formId === 'chosen') { pat = sp.legend ? 5 : 1; cols = HAMA_COLS[0]; coat = 0.55; rough = 0.38; }
  else if (formId === 'bakagai') { pat = 2; cols = { base: '#b89c5e', ink: '#6e5a34', umbo: '#8a6a8a' }; coat = 0.75; rough = 0.35; }
  else { pat = 3; cols = { base: '#e6e0d4', ink: '#9a8a78', umbo: '#d8d0c8' }; coat = 0.05; rough = 0.7; }
  if (sp.legend) { f.ridge = 0.0022; f.D *= 1.08; }
  const single = id === 'kara';
  const mat = shellMaterial(pat, cols, rng.next(), { coat, rough, double: single, coatRough: pat === 0 || pat === 4 ? 0.07 : 0.18 });
  const sides = single ? [1] : [1, -1];
  for (const side of sides) {
    const g = valveGeo(f, side, rng);
    g.scale(L, L, L);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    group.add(m);
  }
  if (single) {
    // ツメタガイにあけられた丸い穴（ときどき）
    if (rng.next() < 0.4) {
      const U = outline(f, 0.25);
      mat.userData.u.uHole.value.set(U[0] * L * 0.75 + rng.range(-0.05, 0.05) * L, U[1] * L * 0.62, f.D * L * 0.9, L * 0.045);
    }
  }
  if (sp.legend) addBarnacles(group, f, L, rng);
  const H = f.hr * L;
  return { mesh: group, L, H, W: f.D * 2 * L, mats: [mat] };
}

// 主の殻に付いたフジツボと、石灰藻
function addBarnacles(group, f, L, rng) {
  const mat = patchMaterial(new THREE.MeshStandardMaterial({ color: '#aaa292', roughness: 0.9 }), { caustics: true });
  const U = outline(f, 0.25);
  for (let i = 0; i < 26; i++) {
    const u = rng.range(0.05, 0.45), s = rng.range(0.25, 0.75);
    const o = outline(f, u);
    const x = U[0] - 0.03 + (o[0] - U[0] + 0.03) * s, y = U[1] * 0.8 + (o[1] - U[1] * 0.8) * s;
    const z = f.D * Math.pow(Math.max(0, 1 - Math.pow(s, 2.3)), 0.58) * 0.97;
    const r = L * rng.range(0.018, 0.04);
    const cone = new THREE.CylinderGeometry(r * 0.45, r, r * 0.9, 7, 1);
    const b = new THREE.Mesh(cone, mat);
    const n = V3(x * 0.4, y * 0.3, 1).normalize();
    b.quaternion.setFromUnitVectors(V3(0, 1, 0), n);
    b.position.set(x * L, y * L, z * L + r * 0.3);
    b.castShadow = true;
    group.add(b);
  }
}

// ───────── 巻き貝 ─────────
function makeSnail(id, cm, seed) {
  const rng = new RNG(Math.floor(seed * 77777) + 3);
  const moon = id === 'tsumeta';
  const turns = moon ? 3.3 : 4.6;
  const ratio = moon ? 3.6 : 2.0; // 1 巻きで大きくなる割合
  const k = Math.log(ratio) / (Math.PI * 2);
  const TH = turns * Math.PI * 2;
  const NT = Math.floor(turns * 90), NA = 26;
  const a = 1, b = moon ? 0.26 : 0.36, c = moon ? 0.92 : 0.78, c2 = moon ? 0.95 : 0.62;
  const pos = [], col = [], idx = [];
  const base = new THREE.Color(), ink = new THREE.Color(), cc = new THREE.Color();
  if (moon) { base.set('#c8b494'); ink.set('#8a7050'); } else { base.set(['#8a8378', '#9b8f7c', '#7d7a74'][Math.floor(rng.next() * 3)]); ink.set('#4a3f36'); }
  for (let i = 0; i <= NT; i++) {
    const th = (i / NT) * TH;
    const g = Math.exp(k * (th - TH));
    const Rc = a * g, Yc = -b * g, r = c * g, r2 = c2 * g;
    for (let j = 0; j <= NA; j++) {
      const al = (j / NA) * Math.PI * 2;
      const rr = Rc + r * Math.cos(al);
      const x = rr * Math.cos(th), z = rr * Math.sin(th), y = Yc + r2 * Math.sin(al);
      pos.push(x, y, z);
      // 色: ナガラミは細かいジグザグとまだら、ツメタガイはつるりと淡い帯
      if (moon) {
        cc.copy(base).lerp(ink, 0.25 + 0.25 * Math.sin(al * 1.0 + 0.5));
        if (Math.sin(al) < -0.55 && i > NT * 0.8) cc.lerp(new THREE.Color('#6a4a30'), 0.7); // へその所の茶色い滑層
      } else {
        const zig = Math.abs(((th * 9 + al * 2.2) / Math.PI) % 2 - 1);
        cc.copy(base).lerp(ink, zig > 0.8 ? 0.5 : 0.1);
        if (Math.sin(al) < -0.3) cc.lerp(new THREE.Color('#d8d0c0'), 0.55); // 裏は白っぽい
      }
      cc.multiplyScalar(0.92 + rng.next() * 0.08);
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NA; j++) {
    const p = i * (NA + 1) + j, q = p + NA + 1;
    idx.push(p, q, p + 1, p + 1, q, q + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // 大きさをそろえる（直径 = cm）
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const dia = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  const S = cm / 100 / dia;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  geo.scale(S, S, S);
  const mat = patchMaterial(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: moon ? 0.3 : 0.38, clearcoat: moon ? 0.8 : 0.5, clearcoatRoughness: 0.2, side: THREE.DoubleSide }), { caustics: true });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  group.add(mesh);
  // 殻口のふた（生きている印）: らせんの終わりの管の断面に、少し奥へ引っこめて置く
  const opMat = patchMaterial(new THREE.MeshStandardMaterial({ color: moon ? '#7a5a38' : '#8a7a5a', roughness: 0.55, side: THREE.DoubleSide }), { caustics: true });
  const op = new THREE.Mesh(new THREE.CircleGeometry(1, 24), opMat);
  const ctr = V3(a * Math.cos(TH), -b, a * Math.sin(TH));
  const tan = V3(-Math.sin(TH), 0, Math.cos(TH));
  const bc = V3((bb.max.x + bb.min.x) / 2, (bb.max.y + bb.min.y) / 2, (bb.max.z + bb.min.z) / 2);
  op.position.copy(ctr).addScaledVector(tan, -0.4 * c).sub(bc).multiplyScalar(S);
  op.quaternion.setFromUnitVectors(V3(0, 0, 1), tan);
  op.scale.set(c * S * 0.72, c2 * S * 0.72, 1);
  // 円の x を水平の半径方向、y を上下に合わせる
  const radial = V3(Math.cos(TH), 0, Math.sin(TH));
  const q2 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(radial, V3(0, 1, 0), tan));
  op.quaternion.copy(q2);
  group.add(op);
  const H = (bb.max.y - bb.min.y) * S;
  return { mesh: group, L: cm / 100, H, W: cm / 100, mats: [mat] };
}

// ───────── 石・流木 ─────────
const n3 = makeNoise3D(55);
function makeStone(cm, seed) {
  const rng = new RNG(Math.floor(seed * 55555) + 1);
  const geo = new THREE.IcosahedronGeometry(0.5, 4);
  const p = geo.attributes.position;
  const sx = rng.range(0.9, 1.25), sy = rng.range(0.45, 0.7), sz = rng.range(0.7, 1.0);
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(), base = new THREE.Color(['#7a746a', '#8d8578', '#5e5a55', '#9a8f80'][Math.floor(rng.next() * 4)]);
  const o = rng.range(0, 50);
  for (let i = 0; i < p.count; i++) {
    const v = V3().fromBufferAttribute(p, i);
    const d = 1 + n3(v.x * 2.2 + o, v.y * 2.2, v.z * 2.2) * 0.14 + n3(v.x * 6 + o, v.y * 6, v.z * 6) * 0.03;
    v.multiplyScalar(d);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    p.setXYZ(i, v.x, v.y, v.z);
    const sp = n3(v.x * 40 + o, v.y * 40, v.z * 40);
    c.copy(base).multiplyScalar(0.85 + sp * 0.3);
    if (sp > 0.55) c.set('#e8e2d6');
    if (sp < -0.6) c.set('#2a2826');
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const S = cm / 100;
  geo.scale(S, S, S);
  const mesh = new THREE.Mesh(geo, patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), { caustics: true }));
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return { mesh: g, L: S * sx, H: S * sy, W: S * sz, mats: [mesh.material] };
}

function makeWood(cm, seed) {
  const rng = new RNG(Math.floor(seed * 33333) + 5);
  const L = cm / 100;
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(V3((i / 12 - 0.5) * L, Math.sin(i * 0.6 + rng.range(0, 3)) * L * 0.03, Math.sin(i * 0.4) * L * 0.05));
  const curve = new THREE.CatmullRomCurve3(pts);
  const r = L * rng.range(0.07, 0.11);
  const geo = new THREE.TubeGeometry(curve, 40, r, 10, false);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const grain = Math.sin((y + z) * 900 + x * 30) * 0.5 + 0.5;
    c.set('#a39a8c').multiplyScalar(0.8 + grain * 0.25);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), { caustics: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  // 切り口
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 10), patchMaterial(new THREE.MeshStandardMaterial({ color: '#8a7a62', roughness: 0.95 }), { caustics: true }));
  cap.position.copy(pts[0]);
  cap.lookAt(pts[0].clone().sub(pts[1]).add(pts[0]));
  const g = new THREE.Group();
  g.add(mesh, cap);
  return { mesh: g, L, H: r * 2, W: r * 2, mats: [mat] };
}

/** id の物を cm の大きさで作る。{ mesh, L, H, W, mats } */
export function makeShell(id, cm, seed = Math.random()) {
  const sp = SHELLS[id];
  if (!sp) throw new Error('unknown shell ' + id);
  if (sp.kind === 'clam' || sp.kind === 'valve') return makeBivalve(id, cm, seed);
  if (sp.kind === 'snail' || sp.kind === 'moon') return makeSnail(id, cm, seed);
  if (sp.kind === 'stone') return makeStone(cm, seed);
  return makeWood(cm, seed);
}

/** 濡れ具合（1 = 水から出したばかりでつやつや） */
export function setWet(shell, w) {
  for (const m of shell.mats) if (m.userData.u) m.userData.u.uWet.value = w;
}
