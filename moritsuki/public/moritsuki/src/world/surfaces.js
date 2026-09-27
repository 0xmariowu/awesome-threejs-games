// 岩と海藻の表面表現（patchMaterial の fx に渡す）
// どちらも画面上で模様が画素より細かくなる距離では自動で消し、ちらつかせない。

// 岩：ワールド座標のノイズで、ザラついた凹凸（法線）と色むらを描く
export const ROCK_FX = {
  key: 'rock',
  decl: /* glsl */ `
    float rkHash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float rkNoise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(rkHash(i), rkHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(rkHash(i + vec3(0.0, 1.0, 0.0)), rkHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(rkHash(i + vec3(0.0, 0.0, 1.0)), rkHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(rkHash(i + vec3(0.0, 1.0, 1.0)), rkHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
        f.z);
    }
  `,
  color: /* glsl */ `
    float rkH, rkK;
    {
      float px = length(fwidth(vWPos));                 // 1画素あたりの長さ(m)
      rkK = 1.0 - smoothstep(0.012, 0.05, px);
      float n2 = rkNoise(vWPos * 7.1 + 11.0);
      float n3 = rkNoise(vWPos * 21.0 + 5.0);
      // 尾根の立ったノイズ（岩肌の稜）＋細かい粒
      float r1 = 1.0 - abs(rkNoise(vWPos * 3.1) * 2.0 - 1.0);
      rkH = r1 * r1 * 0.55 + n2 * 0.3 + n3 * 0.15 * (1.0 - smoothstep(0.004, 0.015, px));
      // 大きな色むら（遠くでも安定）と、近くだけの細かい陰影
      diffuseColor.rgb *= 0.84 + rkNoise(vWPos * 0.9 + 3.0) * 0.3;
      diffuseColor.rgb *= mix(1.0, 0.62 + rkH * 0.6, rkK);
    }
  `,
  normal: /* glsl */ `
    {
      vec3 sp = -vViewPosition;
      vec3 sx = dFdx(sp), sy = dFdy(sp);
      vec2 dH = vec2(dFdx(rkH), dFdy(rkH)) * 0.035 * rkK;
      vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
      float det = dot(sx, r1) * faceDirection;
      vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
      normal = normalize(abs(det) * normal - grad);
    }
  `,
};

// 海藻の葉：中肋と葉脈、太陽を透かして光る透過光
// （リボンの uv.x = 幅方向 0〜1、uv.y = 根元→先）
export const LEAF_FX = {
  key: 'leaf',
  vdecl: 'varying vec2 vLeaf;',
  vcode: 'vLeaf = uv;',
  decl: 'varying vec2 vLeaf;',
  color: /* glsl */ `
    {
      float across = abs(vLeaf.x - 0.5) * 2.0;
      float fade = 1.0 - smoothstep(0.3, 1.0, fwidth(vLeaf.y) * 70.0);
      float mid = 1.0 - smoothstep(0.0, 0.14, across);
      float vein = pow(abs(sin(vLeaf.y * 70.0 - across * 5.0)), 10.0) * (1.0 - across) * fade;
      float edge = smoothstep(0.7, 1.0, across);
      diffuseColor.rgb *= 0.9 + mid * 0.3 + vein * 0.18 - edge * 0.1;
    }
  `,
  light: /* glsl */ `
    {
      vec3 lv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
      vec3 vv = normalize(vViewPosition);
      float thru = pow(max(dot(-vv, lv), 0.0), 3.0) * 0.9 + max(dot(-normal, lv), 0.0) * 0.35;
      vec3 ab = vWPos.y < 0.0 ? uwAbsorb(vWPos.y) : vec3(1.0);
      reflectedLight.indirectDiffuse += diffuseColor.rgb * uSunCol * ab * thru * 0.4;
    }
  `,
};
