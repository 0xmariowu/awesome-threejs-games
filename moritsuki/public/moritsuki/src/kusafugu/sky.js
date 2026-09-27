// 夏の夜空: 地平から天頂への藍のグラデーション・星（瞬く）・天の川・月（海・かさ）・月に照らされた薄い雲・沖の漁火
// 空の色の元（skyColor）は shade.js と共通なので、水面に映る空とそろう
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';

export class NightSky {
  constructor() {
    this.uniforms = { ...U, uStars: { value: 1 } };
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
        uniform float uStars;
        varying vec3 vDir;
        float h31(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        vec3 h33(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.xxy + p.yxx) * p.zyx);
        }
        // 星の層: 方向を格子に切って、マスに 1 つあるかないか
        vec3 starLayer(vec3 d, float S, float thr, float gain) {
          vec3 p = d * S;
          vec3 ip = floor(p);
          float r = h31(ip);
          if (r < thr) return vec3(0.0);
          vec3 c = ip + 0.2 + 0.6 * h33(ip + 7.1);
          float dist = length(p - c);
          // 1 画素より小さくならないように（見た目の大きさは明るさで）
          float px = fwidth(p.x) + fwidth(p.y);
          float rad = max(px * 1.15, 0.05);
          float k = exp(-dist * dist / (rad * rad));
          float mag = pow((r - thr) / (1.0 - thr), 3.0);
          float tw = 0.75 + 0.25 * sin(uTime * (2.0 + h31(ip + 3.3) * 5.0) + r * 60.0);
          // 色温度: 青白い星・白い星・橙の星
          float ct = h31(ip + 1.7);
          vec3 tint = ct < 0.2 ? vec3(0.7, 0.8, 1.0) : ct > 0.88 ? vec3(1.0, 0.78, 0.55) : vec3(1.0, 0.97, 0.92);
          return tint * k * (0.18 + mag * 4.0) * tw * gain;
        }
        float fbm3(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { s += a * hm_vn(p); p = p * 2.07 + vec2(3.1, 1.7); a *= 0.5; }
          return s;
        }
        void main() {
          vec3 d = normalize(vDir);
          vec3 col = skyColor(d);
          float y = d.y;
          if (y > -0.02) {
            float hz = smoothstep(-0.005, 0.12, y);
            // 天の川: 南の空を低く横切る帯（いて座のあたりが濃い）
            vec3 gp = normalize(vec3(0.25, 0.55, 0.8));
            float band = dot(d, gp);
            float along = atan(d.x, -d.z);
            float mw = exp(-band * band * 18.0);
            vec2 mq = vec2(along * 3.0, band * 9.0);
            float cl = fbm3(mq * 1.4 + 5.0);
            float lane = smoothstep(0.45, 0.7, fbm3(mq * 2.3 + vec2(11.0, 2.0))) * exp(-band * band * 60.0);
            float core = exp(-pow(along - 2.75, 2.0) * 0.8);
            vec3 mwCol = vec3(0.55, 0.6, 0.75) * mw * (0.35 + cl * 0.9) * (0.5 + core * 0.9) * (1.0 - lane * 0.8);
            // 月が明るいので、天の川はうすい
            col += mwCol * 0.028 * hz * uStars;
            // 星（月の近くと地平は見えにくい）
            float md = max(dot(d, uSunDir), 0.0);
            float vis = hz * (1.0 - smoothstep(0.93, 0.995, md) * 0.9) * uStars;
            // 星の数は多すぎないように（2026-09-26 に 1/3 へ）
            vec3 st = starLayer(d, 240.0, 0.99533, 0.9) + starLayer(d, 560.0, 0.99783, 0.45) + starLayer(d, 1200.0, 0.99883, 0.22) * (0.5 + mw * 1.5);
            // 月のまわりの薄い雲（月に照らされて銀色）。星を隠す
            vec2 cp = d.xz / (y + 0.16) * 0.9 + vec2(uTime * 0.0035, uTime * 0.0012);
            float c = fbm3(cp * 1.3);
            float cov = smoothstep(0.55, 0.82, c) * smoothstep(0.02, 0.2, y);
            vec3 cloud = uSunCol * (0.035 + pow(md, 10.0) * 0.5) + uSkyHorizon * 0.4;
            col += st * vis * (1.0 - cov);
            col = mix(col, cloud, cov * 0.75);
            // 月の円盤（海のもよう・ふちが少し暗い）
            float mr = 0.0115;
            vec3 md3 = d - uSunDir;
            float dm = length(md3);
            if (dm < mr * 1.3) {
              vec3 ax = normalize(cross(uSunDir, vec3(0.0, 1.0, 0.0)));
              vec3 ay = cross(ax, uSunDir);
              vec2 q = vec2(dot(md3, ax), dot(md3, ay)) / mr;
              float r = length(q);
              float disk = 1.0 - smoothstep(0.96, 1.0, r);
              float maria = smoothstep(0.45, 0.62, fbm3(q * 2.2 + 3.0)) * 0.42 + smoothstep(0.5, 0.7, fbm3(q * 5.0 + 9.0)) * 0.12;
              float limb = 1.0 - pow(max(r, 0.0), 3.0) * 0.35;
              vec3 moon = vec3(1.0, 0.97, 0.9) * (1.0 - maria) * limb * 9.0;
              col = mix(col, moon, disk * (1.0 - cov * 0.5));
            }
          } else {
            // 水平線より下（水面の処理が届かない遠く）
            col = mix(uAirFogCol, vec3(0.005, 0.012, 0.02), smoothstep(-0.0, -0.1, y));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'sky';
  }

  update(camera) {
    this.mesh.position.copy(camera.position);
  }
}
