// 空と水中の背景ドーム
import * as THREE from 'three';
import { U, COMMON_GLSL } from '../core/shaderPatch.js';

export class SkyDome {
  constructor() {
    this.uniforms = { ...U, uCamY: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        uniform float uCamY;
        varying vec3 vDir;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float vn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
          return s;
        }
        void main() {
          vec3 d = normalize(vDir);
          vec3 sd = normalize(uSunDir);
          vec3 col;
          if (uUnder > 0.5) {
            float y = min(uCamY + d.y * 45.0, 0.0);
            col = uwFogColor(y);
            // 屈折した太陽の方向がほのかに明るい
            vec3 rs = normalize(vec3(sd.x * 0.6, 1.0, sd.z * 0.6));
            float g = max(dot(d, rs), 0.0);
            col += uWaterShallow * (pow(g, 6.0) * 0.35) * exp(uCamY * 0.05);
          } else {
            col = skyColor(d);
            float sdot = max(dot(d, sd), 0.0);
            col += uSunCol * smoothstep(0.99955, 0.99985, sdot) * 30.0;
            // 雲
            if (d.y > 0.0) {
              vec2 cp = d.xz / (d.y + 0.12) * 1.3 + vec2(uTime * 0.004, uTime * 0.002);
              float c = fbm(cp);
              float cov = smoothstep(0.52, 0.78, c);
              float thick = smoothstep(0.5, 0.95, c);
              vec3 lit = mix(uSkyHorizon * 1.15, vec3(1.0), 0.55) + uSunCol * pow(sdot, 4.0) * 0.6;
              vec3 cc = mix(lit, lit * 0.62, thick);
              float fade = smoothstep(0.0, 0.18, d.y);
              col = mix(col, cc, cov * fade * 0.9);
            }
            // 水平線より下（遠くの海）
            if (d.y < 0.0) col = mix(uAirFogCol, uWaterDeep * 1.5, (1.0 - smoothstep(-0.08, 0.0, d.y)));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'sky';
  }

  update(camera) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uCamY.value = camera.position.y;
  }
}
