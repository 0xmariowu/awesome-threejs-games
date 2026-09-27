// 光る点（ホタル・生き物の目の反射・遠くの灯り・ライトの中を飛ぶ虫）
// 水面のあとに重ねて描く。深度は自分で比べる（物の陰は隠れ、水の下は水の中の道のりで弱まる）
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';
import { SCREEN, SCREEN_GLSL } from './water.js';

const VS = /* glsl */ `
  ${COMMON_GLSL}
  attribute vec4 aCol;     // 色（rgb）と明るさ
  attribute vec2 aSize;    // 大きさ（m）・最小の画素
  varying vec4 vCol;
  varying float vDepth;
  varying vec3 vW;
  uniform float uPR;
  void main() {
    vCol = aCol;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;
    float px = aSize.x * uPR * projectionMatrix[1][1] * 360.0 / max(-mv.z, 0.05);
    gl_PointSize = max(px, aSize.y * uPR);
    if (aCol.a <= 0.0) gl_PointSize = 0.0;
    // 点が小さすぎて見えない分は明るさで補う
    vCol.a *= min(1.0, px / max(aSize.y * uPR, 1e-3) + 0.35);
    vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
  }
`;
const FS = /* glsl */ `
  ${COMMON_GLSL}
  ${SCREEN_GLSL}
  varying vec4 vCol;
  varying float vDepth;
  varying vec3 vW;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    vec2 suv = gl_FragCoord.xy / uRes;
    float zs = texture2D(tDepth, suv).x;
    // 物の陰（少しだけ余裕を持たせる: 目は体の表面にある）
    vec3 ws = worldAt(suv, zs);
    float behind = length(vW - cameraPosition) - length(ws - cameraPosition);
    if (zs < 0.99999 && behind > 0.03) discard;
    float core = exp(-d * d * 60.0);
    float halo = exp(-d * d * 12.0) * 0.35;
    vec3 col = vCol.rgb * vCol.a * (core + halo);
    // 水の下
    float lv = ditchLevel(vW);
    float wd = lv - vW.y;
    if (wd > 0.0) {
      vec3 ab = exp(-uWaterSigma * (wd + wd / max(0.3, abs(normalize(vW - cameraPosition).y))));
      col *= ab;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Glow {
  constructor(scene, max, { renderOrder = 5 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 2).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { ...U, ...SCREEN, uPR: { value: 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    scene.add(this.points);
    this.n = 0;
  }
  setPR(pr) { this.uniforms.uPR.value = pr; }
  /** i 番目の点を置く（x, y, z, 色 r g b, 明るさ a, 大きさ m, 最小画素） */
  set(i, x, y, z, r, g, b, a, sizeM = 0.01, minPx = 1.5) {
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.size[i * 2] = sizeM; this.size[i * 2 + 1] = minPx;
  }
  off(i) { this.col[i * 4 + 3] = 0; }
  commit(n = this.max) {
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true;
    g.attributes.aCol.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}
