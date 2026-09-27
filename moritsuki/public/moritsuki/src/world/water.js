// 海面: 上からはフレネル反射と透き通る浅瀬、下からはスネルの窓と全反射
import * as THREE from 'three';
import { U, COMMON_GLSL } from '../core/shaderPatch.js';
import { WORLD_SIZE } from './terrain.js';

// CPU と GPU で同じ波を使う (dirX, dirZ, 波長, 振幅)
const WAVES = [
  [0.8, 0.6, 23, 0.15],
  [-0.42, 0.91, 13.5, 0.085],
  [0.95, -0.31, 7.7, 0.045],
  [0.21, -0.98, 4.3, 0.022],
];
const G = 9.81;
const W = WAVES.map(([dx, dz, L, A]) => {
  const len = Math.hypot(dx, dz);
  const k = (2 * Math.PI) / L;
  return { dx: dx / len, dz: dz / len, k, A, w: Math.sqrt(G * k) * 0.8 };
});

export function waveHeight(x, z, t) {
  let h = 0;
  for (const v of W) h += v.A * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t);
  return h;
}

export const WAVE_GLSL = `
const int NW = ${W.length};
vec4 WV[NW];
void initWaves() {
  ${W.map((v, i) => `WV[${i}] = vec4(${v.dx.toFixed(5)}, ${v.dz.toFixed(5)}, ${v.k.toFixed(5)}, ${v.A.toFixed(5)});`).join('\n  ')}
}
float WW[NW];
void initW() {
  ${W.map((v, i) => `WW[${i}] = ${v.w.toFixed(5)};`).join('\n  ')}
}
vec3 waveHN(vec2 p, float t) {
  float h = 0.0; vec2 g = vec2(0.0);
  for (int i = 0; i < NW; i++) {
    float ph = WV[i].z * dot(WV[i].xy, p) - WW[i] * t;
    h += WV[i].w * sin(ph);
    g += WV[i].xy * (WV[i].w * WV[i].z * cos(ph));
  }
  return vec3(h, g);
}
`;

export class Water {
  constructor(terrain) {
    const size = 1500;
    const geo = new THREE.PlaneGeometry(size, size, 300, 300);
    geo.rotateX(-Math.PI / 2);
    this.uniforms = {
      ...U,
      tHeight: { value: terrain.heightTex },
      uWorldSize: { value: WORLD_SIZE },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      vertexShader: /* glsl */ `
        ${COMMON_GLSL}
        ${WAVE_GLSL}
        varying vec3 vWPos;
        varying vec2 vGrad;
        varying float vH;
        void main() {
          initWaves(); initW();
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 hn = waveHN(wp.xz, uTime);
          wp.y += hn.x;
          vH = hn.x;
          vGrad = hn.yz;
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        uniform sampler2D tHeight;
        uniform float uWorldSize;
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

        void main() {
          vec3 toC = cameraPosition - vWPos;
          float dist = length(toC);
          vec3 V = toC / dist;
          float detailFade = exp(-dist * 0.012);
          vec2 g = vGrad + detailGrad(vWPos.xz, uTime) * detailFade;
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

          vec2 huv = (vWPos.xz + uWorldSize * 0.5) / uWorldSize;
          float inside = step(0.0, huv.x) * step(huv.x, 1.0) * step(0.0, huv.y) * step(huv.y, 1.0);
          float th = mix(-40.0, texture2D(tHeight, clamp(huv, 0.0, 1.0)).r * 50.0 - 30.0, inside);
          float depth = max(-th, 0.0);

          vec3 col; float alpha;
          if (gl_FrontFacing) {
            float ndv = max(dot(N, V), 0.0);
            float fres = 0.02 + 0.98 * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
            vec3 R = reflect(-V, N);
            R.y = abs(R.y);
            vec3 refl = skyColor(R);
            float sunH = clamp(uSunDir.y * 1.4, 0.15, 1.0);
            vec3 shallowC = vec3(0.16, 0.72, 0.68) * sunH;
            vec3 deepC = uWaterDeep * 1.4;
            vec3 body = mix(shallowC, deepC, smoothstep(0.4, 14.0, depth));
            // 波頭の透過光
            body += uWaterShallow * 0.25 * clamp(vH * 3.0, 0.0, 1.0) * sunH;
            float sdr = max(dot(R, normalize(uSunDir)), 0.0);
            float spec = pow(sdr, 700.0) * 14.0 + pow(sdr, 80.0) * 0.45;
            col = mix(body, refl, fres) + uSunCol * spec;
            alpha = mix(0.22, 0.94, smoothstep(0.2, 9.0, depth));
            alpha = clamp(alpha + fres * 0.85 + spec, 0.0, 1.0);
            // 波打ち際の泡
            float n = vnoise(vWPos.xz * 1.6 + vec2(uTime * 0.25, -uTime * 0.18)) * 0.6 + vnoise(vWPos.xz * 4.3 - uTime * 0.4) * 0.4;
            float band = 1.0 - smoothstep(0.0, 1.1, depth - vH * 1.5);
            float surge = 0.5 + 0.5 * sin(uTime * 1.3 - depth * 5.0 + vnoise(vWPos.xz * 0.2) * 6.0);
            float foam = band * smoothstep(0.55 - surge * 0.35, 0.8, n + band * 0.35);
            col = mix(col, vec3(0.93, 0.97, 1.0) * max(sunH, 0.4), foam * 0.9);
            alpha = max(alpha, foam * 0.92);
            float af = 1.0 - exp(-uAirFog * dist);
            col = mix(col, uAirFogCol, af);
            alpha = mix(alpha, 1.0, smoothstep(60.0, 260.0, dist));
          } else {
            vec3 I = -V;
            // 真上ほど 1、臨界角(約49°)で 0.66
            float c = clamp(dot(I, N), 0.0, 1.0);
            vec3 T = refract(I, -N, 1.333);
            if (dot(T, T) < 1e-4) T = normalize(vec3(I.x, 0.02, I.z));
            vec3 base = uwFogColor(0.0);
            // 全反射側: 水の色（少し暗い）
            vec3 tir = mix(uwFogColor(-5.0), base, 0.55);
            // スネルの窓: 空が水色に染まって見える
            vec3 sky = skyColor(T) * mix(vec3(1.0), uWaterShallow * 2.2, 0.35) * 0.95;
            float sd = max(dot(T, normalize(uSunDir)), 0.0);
            sky += uSunCol * (pow(sd, 300.0) * 22.0 + pow(sd, 18.0) * 0.5);
            float win = smoothstep(0.64, 0.74, c);
            float trans = smoothstep(0.64, 1.0, c) * 0.35 + 0.65;
            float re = (c - 0.67) / 0.035;
            float rim = exp(-re * re) * 0.5;
            col = mix(tir, sky * trans, win) + base * rim;
            float ff = 1.0 - exp(-uFogDensity * dist * 0.85);
            col = mix(col, base, ff);
            alpha = 1.0;
          }
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'water';
  }

  update(camera) {
    // グリッドにスナップしてカメラを追従（頂点の泳ぎを防ぐ）
    const step = 5;
    this.mesh.position.x = Math.round(camera.position.x / step) * step;
    this.mesh.position.z = Math.round(camera.position.z / step) * step;
  }
}
