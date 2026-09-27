// しゃぼん玉の輪（手に持った吹き具）：桃色の樹脂の輪（内側は液を含む細かな刻み）と、滑り止めの筋の柄
// 石けん液に濡れた艶、日を透かした樹脂の透け、輪に張った膜（厚みのむらで干渉色が流れ、下ほど厚い）
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';

const VS = /* glsl */ `
${ALL}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vLocal = position;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS = /* glsl */ `
${ALL}
${SHADOW}
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uSunDir;
  float nl = max(dot(N, L), 0.0);
  float sh = sunShadow(vWorld, nl, gl_FragCoord.xy);
  // 樹脂：少し色むら（成形の流れ）
  vec3 alb = uColor * (0.9 + 0.2 * texture(tNoise, vLocal.xy * 9.0).r);
  vec3 col = alb * (uSunCol * nl * sh * 0.85 + shIrr(N));
  // 透け（日を背にすると内から光る）と、厚いところほど濃い色
  col += uColor * uColor * uSunCol * pow(sat(dot(-V, L)), 2.0) * 0.7 * sh;
  col += uColor * shIrr(-N) * 0.25;
  // 濡れた艶：鋭いハイライトと空の映り込み
  vec3 H = normalize(L + V);
  float NoV = max(dot(N, V), 0.0);
  float F = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
  col += uSunCol * pow(max(dot(N, H), 0.0), 400.0) * 3.0 * sh;
  col += uSunCol * pow(max(dot(N, H), 0.0), 60.0) * 0.25 * sh;
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uFogCol * 1.05, shIrr(vec3(0.0, 1.0, 0.0)) * 1.2, sqrt(sat(R.y)));
  vec3 env = mix(vec3(0.08, 0.09, 0.06), sky, smoothstep(-0.05, 0.08, R.y));
  // 液の膜の干渉（うっすら）
  float th = 0.5 + 0.5 * sin(dot(vLocal, vec3(310.0, 170.0, 230.0)) + uTime * 0.7);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (th * 1.6 + vec3(0.0, 0.33, 0.67)));
  col += env * F * mix(vec3(1.0), irid * 1.4, 0.35);
  gl_FragColor = vec4(col, 1.0);
}
`;

// 輪に張った石けんの膜
const FILM_VS = /* glsl */ `
${ALL}
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vP = position.xy / 0.0292;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FILM_FS = /* glsl */ `
${ALL}
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vP;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  float c = abs(dot(N, V));
  if (dot(N, V) < 0.0) N = -N;
  float r = length(vP);
  // 膜の厚み（nm）：渦を巻くむら・重力で下ほど厚い・縁は液だまり
  float t = uTime * 0.02;
  // 渦：ゆっくり回る低い周波数のむら
  float ca = cos(uTime * 0.15), sa = sin(uTime * 0.15);
  vec2 q = mat2(ca, sa, -sa, ca) * vP * 0.09;
  vec2 sw = vec2(texture(tNoise, q + vec2(t, -t * 0.7) + 0.3).g, texture(tNoise, q * 1.7 + vec2(-t * 0.5, t) + 0.6).g);
  float th = 180.0 + 700.0 * sw.x + 300.0 * sw.y + 420.0 * sat(-vP.y * 0.5 + 0.2) + 900.0 * smoothstep(0.85, 1.0, r);
  // 薄膜の干渉（屈折率1.33）
  float ct = sqrt(max(1.0 - (1.0 - c * c) / 1.769, 0.0));
  float opd = 2.0 * 1.33 * th * ct;
  vec3 lam = vec3(650.0, 530.0, 450.0);
  vec3 interf = 0.5 - 0.5 * cos(6.2831 * opd / lam);
  float F = 0.03 + 0.97 * pow(1.0 - c, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uFogCol * 1.05 + uFogSun * 0.2, shIrr(vec3(0.0, 1.0, 0.0)) * 1.3, sqrt(sat(R.y)));
  vec3 env = mix(vec3(0.07, 0.085, 0.05), sky, smoothstep(-0.05, 0.08, R.y));
  vec3 col = env * interf * (0.07 + 1.4 * F);
  // 日のきらめき
  vec3 H = normalize(uSunDir + V);
  col += uSunCol * interf * pow(max(dot(N, H), 0.0), 300.0) * 2.0;
  // 縁の液だまりは白く光る
  col += env * smoothstep(0.9, 1.0, r) * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function buildWand(shared) {
  // 輪：内側に細かな刻み（液を含む）
  const R0 = 0.032, r0 = 0.0036;
  const g1 = new THREE.TorusGeometry(R0, r0, 16, 96);
  const p = g1.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = Math.atan2(y, x);
    const cx = Math.cos(u) * R0, cy = Math.sin(u) * R0;
    const ox = x - cx, oy = y - cy, oz = z;
    const ol = Math.hypot(ox, oy, oz) || 1;
    const inward = Math.max(0, -(ox * Math.cos(u) + oy * Math.sin(u)) / ol);
    const ridge = 0.0009 * Math.pow(0.5 + 0.5 * Math.cos(u * 36), 3) * inward;
    p.setXYZ(i, x + ox / ol * ridge, y + oy / ol * ridge, z + oz / ol * ridge);
  }
  g1.computeVertexNormals();
  // 柄：輪とのつなぎ・滑り止めの筋・丸い端
  const prof = [[0.0, -0.186], [0.0026, -0.1855], [0.0038, -0.183], [0.0044, -0.178]];
  for (let k = 0; k < 10; k++) { const y = -0.172 + k * 0.007; prof.push([0.0046, y], [0.0042, y + 0.0035]); }
  prof.push([0.0042, -0.1], [0.0036, -0.06], [0.003, -0.042], [0.0036, -0.0365], [0.0028, -0.034]);
  const g2 = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  const merged = new THREE.BufferGeometry();
  const pos = [], nrm = [], idx = [];
  let off = 0;
  for (const g of [g1, g2]) {
    pos.push(...g.attributes.position.array); nrm.push(...g.attributes.normal.array);
    idx.push(...Array.from(g.index.array, (i) => i + off));
    off += g.attributes.position.count;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  merged.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ uniforms: { ...shared, uColor: { value: new THREE.Color(0.85, 0.28, 0.42) } }, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide });
  const m = new THREE.Mesh(merged, mat);
  m.frustumCulled = false;
  m.userData.farShadow = false;
  m.userData.nearShadow = false;
  // 膜
  const fg = new THREE.CircleGeometry(R0 - r0 * 0.8, 48);
  const film = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: FILM_VS, fragmentShader: FILM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  film.frustumCulled = false;
  film.renderOrder = 10;
  film.userData.farShadow = false;
  film.userData.nearShadow = false;
  m.add(film);
  return m;
}
