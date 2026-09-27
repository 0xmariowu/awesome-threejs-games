// 夏の夜明け前の空: 満天の星・天の川・東の低い所に細い月・南の町の明かりの照り返し・北東から白む夜明け
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';

export class NightSky {
  constructor() {
    this.uniforms = { ...U, uMoonPhase: { value: 0.28 } };
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
        uniform float uMoonPhase;
        varying vec3 vDir;
        // 星: 方向を格子に切って、格子ごとに 1 つ
        vec3 stars(vec3 d, float scale, float thr) {
          vec3 p = d * scale;
          vec3 ip = floor(p);
          vec3 fp = fract(p) - 0.5;
          float h = fract(sin(dot(ip, vec3(127.1, 311.7, 74.7))) * 43758.5453);
          if (h < thr) return vec3(0.0);
          vec3 o = vec3(fract(h * 17.3), fract(h * 31.7), fract(h * 57.1)) - 0.5;
          float r = length(fp - o * 0.6);
          float b = pow((h - thr) / (1.0 - thr), 3.0);
          float tw = 0.7 + 0.3 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
          float core = exp(-r * r * 900.0);
          vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), fract(h * 91.0));
          return tint * core * b * tw * 3.2;
        }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 col = nightSky(d);
          // 南（+z）の町の明かりの照り返し
          float south = max(dot(normalize(vec3(d.x, 0.0, d.z)), vec3(-0.25, 0.0, 0.97)), 0.0);
          col += vec3(0.07, 0.045, 0.03) * pow(south, 3.0) * exp(-max(y, 0.0) * 9.0) * (1.0 - uDawn * 0.6);
          if (y > -0.02) {
            float hz = smoothstep(-0.02, 0.12, y);
            // 天の川（北東〜南西に斜めにかかる帯）
            vec3 axis = normalize(vec3(0.55, 0.35, 0.75));
            float band = exp(-pow(dot(d, axis) / 0.3, 2.0));
            float cl = un_fbm(vec2(atan(d.z, d.x) * 3.0, d.y * 6.0)) * un_fbm(vec2(d.x * 9.0 + 3.0, d.z * 9.0));
            vec3 mw = vec3(0.022, 0.024, 0.032) * band * (0.25 + cl * cl * 2.2);
            // 暗い筋（塵）
            mw *= 1.0 - smoothstep(0.45, 0.7, un_fbm(vec2(d.x * 14.0, d.z * 14.0 + d.y * 7.0))) * 0.6 * band;
            float starK = hz * (1.0 - uDawn * 0.85);
            col += mw * starK;
            col += stars(d, 180.0, 0.93) * starK;
            col += stars(d, 420.0, 0.965) * starK * 0.6;
            col += stars(d, 90.0, 0.985) * starK * 1.5;
            // 月（細い月。欠けた側は暗い地球照）
            vec3 md = normalize(uMoonDir);
            float mdot = dot(d, md);
            float mr = acos(clamp(mdot, -1.0, 1.0));
            float R = 0.0105;
            if (mr < R * 1.2) {
              vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
              vec3 up = cross(right, md);
              vec2 uv = vec2(dot(d - md, right), dot(d - md, up)) / R;
              float disk = 1.0 - smoothstep(0.92, 1.0, length(uv));
              // 光っている側（下の右寄りが太陽の側 = 夜明け前の細い月）
              vec2 sunSide = normalize(vec2(-0.55, -0.83));
              float z = sqrt(max(0.0, 1.0 - dot(uv, uv)));
              vec3 nrm = vec3(uv, z);
              vec3 sunV = normalize(vec3(sunSide * 0.98, -0.72 + uMoonPhase));
              float litK = smoothstep(-0.05, 0.12, dot(nrm, sunV));
              float mare = 0.8 + 0.2 * un_fbm(uv * 3.0 + 4.0);
              col += (vec3(1.0, 0.96, 0.86) * 2.4 * litK * mare + vec3(0.02, 0.025, 0.04) * (1.0 - litK)) * disk;
            }
          }
          // 地平線より下（遠くの暗い地面・もや）
          if (y < 0.0) col = mix(col, uFogCol * 0.8, smoothstep(0.0, -0.05, y));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  update(camera) { this.mesh.position.copy(camera.position); }
}
