// 海と川の水面: 銛一本の海（波・フレネル反射・透き通る浅瀬・波打ち際の泡）を町の地形に合わせて使う
import * as THREE from 'three';
import { U, COMMON_GLSL } from '../core/shaderPatch.js';
import { WAVE_GLSL } from '../world/water.js';
import { HAZE_GLSL } from './scenery/haze.js';

function heightTex(g) {
  const d = new Uint16Array(g.nx * g.nz);
  for (let i = 0; i < d.length; i++) d[i] = THREE.DataUtils.toHalfFloat(g.h[i]);
  const t = new THREE.DataTexture(d, g.nx, g.nz, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// もやの濃さ（地面の高さでの値。scenery/haze.js の積分に使う）
export const TOWN_FOG = { value: 0.00105 };

function makeMaterial(data, waves) {
  const { core, outer } = data;
  const rect = (g) => new THREE.Vector4(g.x0, g.z0, g.x1 - g.x0, g.z1 - g.z0);
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      ...U,
      uCore: { value: heightTex(core) }, uCoreR: { value: rect(core) },
      uOuter: { value: heightTex(outer) }, uOuterR: { value: rect(outer) },
      uWaves: { value: waves ? 1 : 0 },
      uTownFog: TOWN_FOG,
    },
    vertexShader: /* glsl */ `
      ${COMMON_GLSL}
      ${WAVE_GLSL}
      uniform float uWaves;
      varying vec3 vWPos;
      varying vec2 vGrad;
      varying float vH;
      void main() {
        initWaves(); initW();
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // 空から見下ろすと細かい波が頂点の格子と干渉して縞になるので、高いほど凪にする
        float lift = clamp((cameraPosition.y - 80.0) / 220.0, 0.0, 1.0);
        vec3 hn = waveHN(wp.xz, uTime) * uWaves * (1.0 - lift * 0.85);
        wp.y += hn.x;
        vH = hn.x;
        vGrad = hn.yz;
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON_GLSL}
      uniform sampler2D uCore, uOuter;
      uniform vec4 uCoreR, uOuterR;
      uniform float uWaves, uTownFog;
      ${HAZE_GLSL}
      varying vec3 vWPos;
      varying vec2 vGrad;
      varying float vH;

      float vhash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(vhash(i), vhash(i + vec2(1, 0)), f.x), mix(vhash(i + vec2(0, 1)), vhash(i + vec2(1, 1)), f.x), f.y);
      }
      vec2 detailGrad(vec2 p, float t) {
        vec2 g = vec2(0.0);
        g += vec2(0.62, 0.78) * cos(dot(vec2(0.62, 0.78), p) * 2.1 - t * 2.6) * 0.07;
        g += vec2(-0.91, 0.41) * cos(dot(vec2(-0.91, 0.41), p) * 3.3 - t * 3.1) * 0.05;
        g += vec2(0.13, -0.99) * cos(dot(vec2(0.13, -0.99), p) * 5.2 - t * 4.0) * 0.035;
        g += vec2(-0.55, -0.83) * cos(dot(vec2(-0.55, -0.83), p) * 8.7 - t * 5.2) * 0.022;
        g += vec2(0.97, -0.24) * cos(dot(vec2(0.97, -0.24), p) * 13.1 - t * 6.3) * 0.014;
        return g;
      }
      float ground(vec2 p) {
        vec2 a = (p - uCoreR.xy) / uCoreR.zw;
        if (all(greaterThan(a, vec2(0.002))) && all(lessThan(a, vec2(0.998)))) return texture2D(uCore, a).r;
        vec2 b = (p - uOuterR.xy) / uOuterR.zw;
        if (all(greaterThan(b, vec2(0.0))) && all(lessThan(b, vec2(1.0)))) return texture2D(uOuter, b).r;
        return -30.0;
      }

      void main() {
        float depth = vWPos.y - vH - ground(vWPos.xz);
        if (depth < -0.3) discard;
        depth = max(depth, 0.0);
        vec3 toC = cameraPosition - vWPos;
        float dist = length(toC);
        vec3 V = toC / dist;
        float detailFade = exp(-dist * 0.012);
        vec2 g = vGrad + detailGrad(vWPos.xz, uTime) * detailFade * mix(0.5, 1.0, uWaves);
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 refl = skyColor(R);
        float sunH = clamp(uSunDir.y * 1.4, 0.15, 1.0);
        // 水の色は深さで 3 段になめらかに変わる（浅い: 青みどり → 中: 青緑 → 深い: 紺碧）。
        // 白っぽい水色から濃紺へ急に切り替わると、空から見て雲のようなまだらになるので、
        // 浅い色は少し沈め、深い色は少し明るく、あいだに中間の色をはさむ
        float dn = vnoise(vWPos.xz * 0.018) * 0.65 + vnoise(vWPos.xz * 0.061) * 0.35;
        float od = depth * mix(0.8, 1.25, dn);               // 海底の起伏・藻場で少しむらを出す
        vec3 shallowC = vec3(0.10, 0.52, 0.43);
        vec3 midC = vec3(0.028, 0.25, 0.31);
        vec3 deepC = vec3(0.010, 0.085, 0.185);
        vec3 body = mix(mix(shallowC, midC, 1.0 - exp(-od / 3.0)), deepC, 1.0 - exp(-od / 11.0)) * sunH;
        // 浅い所の藻場（青緑の上に、ところどころ暗い緑）
        body = mix(body, vec3(0.03, 0.16, 0.10) * sunH, smoothstep(0.62, 0.8, dn) * (1.0 - smoothstep(1.5, 7.0, depth)) * 0.45);
        body += uWaterShallow * 0.25 * clamp(vH * 3.0, 0.0, 1.0) * sunH;
        float sdr = max(dot(R, normalize(uSunDir)), 0.0);
        float spec = pow(sdr, 700.0) * 14.0 + pow(sdr, 80.0) * 0.45;
        vec3 col = mix(body, refl, fres) + uSunCol * spec;
        float alpha = mix(0.25, 0.97, 1.0 - exp(-od / 3.2));
        alpha = clamp(alpha + fres * 0.85 + spec, 0.0, 1.0);
        // 波打ち際の泡
        float n = vnoise(vWPos.xz * 1.6 + vec2(uTime * 0.25, -uTime * 0.18)) * 0.6 + vnoise(vWPos.xz * 4.3 - uTime * 0.4) * 0.4;
        float band = 1.0 - smoothstep(0.0, 0.8, depth - vH * 1.5);
        float surge = 0.5 + 0.5 * sin(uTime * 1.3 - depth * 6.0 + vnoise(vWPos.xz * 0.2) * 6.0);
        float foam = band * smoothstep(0.55 - surge * 0.35, 0.8, n + band * 0.35) * mix(0.35, 1.0, uWaves);
        col = mix(col, vec3(0.93, 0.97, 1.0) * max(sunH, 0.4), foam * 0.9);
        alpha = max(alpha, foam * 0.92);
        col = mix(col, hazeColor(vWPos, cameraPosition, uAirFogCol), hazeAmount(vWPos, cameraPosition, uTownFog));
        alpha = mix(alpha, 1.0, smoothstep(80.0, 400.0, dist));
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

export class TownWater {
  constructor(data, terrainInfo) {
    this.group = new THREE.Group();
    const mat = makeMaterial(data, true);
    // 近く: 波で上下する細かい格子（カメラについて行く）
    this.near = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 180, 180).rotateX(-Math.PI / 2), mat);
    this.near.frustumCulled = false;
    this.near.renderOrder = 1;
    // 遠く: 平らな輪（近くの格子の外側）
    this.far = new THREE.Mesh(new THREE.RingGeometry(400, 12000, 64, 1).rotateX(-Math.PI / 2), mat);
    this.far.frustumCulled = false;
    this.far.renderOrder = 0;
    this.group.add(this.near, this.far);
    // 川と池（その場所の水面の高さで、波なし）
    const river = riverMesh(data, terrainInfo);
    if (river) {
      river.material = makeMaterial(data, false);
      river.renderOrder = 1;
      this.group.add(river);
    }
  }
  update(camera) {
    const s = 5;
    const x = Math.round(camera.position.x / s) * s, z = Math.round(camera.position.z / s) * s;
    this.near.position.set(x, 0, z);
    this.far.position.set(x, -0.25, z);
  }
}

function riverMesh(data, terrainInfo) {
  const { core } = data, { level, kindAt } = terrainInfo.water, { nx, nz } = core;
  const lv = (i, j) => {
    const c = j * nx + i;
    if (kindAt[c]) return level[c];
    let s = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const d = jj * nx + ii;
      if (kindAt[d]) { s += level[d]; n++; }
    }
    return n ? s / n : 0;
  };
  const pos = [], idx = [], map = new Map();
  const vid = (i, j) => {
    const k = j * nx + i;
    if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(core.xOf(i), lv(i, j) + 0.02, core.zOf(j)); }
    return map.get(k);
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = j * nx + i;
    if (!(kindAt[c] || kindAt[c + 1] || kindAt[c + nx] || kindAt[c + nx + 1])) continue;
    // 河口の海面と同じ高さのところは海に任せる
    if (Math.max(lv(i, j), lv(i + 1, j), lv(i, j + 1), lv(i + 1, j + 1)) < 0.06) continue;
    const a = vid(i, j), b = vid(i + 1, j), cc = vid(i, j + 1), d = vid(i + 1, j + 1);
    idx.push(a, cc, b, b, cc, d);
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo);
}
