// 鳶（とんび）：谷の上空をゆっくり輪を描いて滑空する。ときどき羽ばたく
import * as THREE from 'three';
import { ALL } from './glsl.js';

const BVS = /* glsl */ `
${ALL}
attribute vec4 aB;      // x=翼の外側への割合(-1..1) y=翼か胴か z=尾 w=予備
uniform vec4 uBird[4];  // xyz=中心 w=半径
uniform vec4 uBird2[4]; // x=角速度 y=位相 z=高さの揺れ w=予備
varying vec3 vN;
varying vec3 vWorld;
varying float vUnder;
void main() {
  int id = gl_InstanceID;
  vec4 b = uBird[id], b2 = uBird2[id];
  float ang = uTime * b2.x + b2.y;
  vec3 c = b.xyz + vec3(cos(ang) * b.w, sin(uTime * 0.21 + b2.y) * b2.z, sin(ang) * b.w);
  vec3 fwd = normalize(vec3(-sin(ang), 0.0, cos(ang)) * sign(b2.x));
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(fwd, up));
  // 内側へ傾く
  float bank = 0.35 * sign(b2.x);
  vec3 upB = normalize(up * cos(bank) + right * sin(bank));
  vec3 rB = normalize(cross(fwd, upB));
  // 羽ばたき：8秒ごとに3回ほど
  float cyc = fract((uTime + b2.y * 3.0) / 8.0);
  float flap = cyc < 0.18 ? sin(cyc / 0.18 * 3.1416 * 3.0) * 0.55 : 0.0;
  vec3 p = position;
  float span = abs(aB.x);
  p.y += (0.12 + flap) * span * span * 0.9 + 0.06 * span;
  vec3 wp = c + fwd * p.x + upB * p.y + rB * p.z;
  vN = normalize(upB + rB * (-aB.x) * 0.15);
  vUnder = aB.y;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const BFS = /* glsl */ `
${ALL}
varying vec3 vN;
varying vec3 vWorld;
varying float vUnder;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 alb = N.y < 0.0 ? vec3(0.09, 0.07, 0.055) : vec3(0.13, 0.095, 0.07);
  vec3 col = alb * (uSunCol * max(dot(N, uSunDir), 0.0) + shIrr(N));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function buildBirds(shared) {
  // 鳶の形（x=前、z=右、y=上）：翼開長1.5m
  const P = [], A = [], I = [];
  const v = (x, y, z, ax, ay) => { P.push(x, y, z); A.push(ax, ay, 0, 0); return P.length / 3 - 1; };
  // 胴
  const n0 = v(0.34, 0, 0, 0, 0), n1 = v(-0.3, 0, 0, 0, 0);
  // 左右の翼（前縁・後縁・先端の指）
  for (const s of [-1, 1]) {
    const r0 = v(0.12, 0, 0.05 * s, 0.05 * s, 1), r1 = v(-0.1, 0, 0.05 * s, 0.05 * s, 1);
    const m0 = v(0.1, 0, 0.42 * s, 0.55 * s, 1), m1 = v(-0.16, 0, 0.42 * s, 0.55 * s, 1);
    const t0 = v(0.02, 0, 0.75 * s, 1.0 * s, 1), t1 = v(-0.12, 0, 0.72 * s, 1.0 * s, 1);
    I.push(r0, m0, r1, r1, m0, m1, m0, t0, m1, m1, t0, t1);
  }
  // 尾（少し切れ込み）
  const a0 = v(-0.28, 0, 0.05, 0, 0), a1 = v(-0.28, 0, -0.05, 0, 0), a2 = v(-0.52, 0, 0.12, 0, 0), a3 = v(-0.48, 0, 0, 0, 0), a4 = v(-0.52, 0, -0.12, 0, 0);
  I.push(a0, a2, a3, a0, a3, a1, a1, a3, a4, n0, a0, a1);
  void n1;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(A, 4));
  g.setIndex(I);
  g.instanceCount = 3;
  const B1 = [new THREE.Vector4(-120, 115, -10, 70), new THREE.Vector4(210, 140, 60, 85), new THREE.Vector4(-380, 125, -60, 60), new THREE.Vector4(0, -999, 0, 1)];
  const B2 = [new THREE.Vector4(0.085, 0.0, 6, 0), new THREE.Vector4(-0.07, 2.1, 8, 0), new THREE.Vector4(0.1, 4.2, 5, 0), new THREE.Vector4(0, 0, 0, 0)];
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...shared, uBird: { value: B1 }, uBird2: { value: B2 } }, vertexShader: BVS, fragmentShader: BFS, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  m.userData.farShadow = false; m.userData.nearShadow = false;
  return m;
}
