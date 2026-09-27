// 蝶：花のある地面（菜の花・れんげ・野の花の原・庭の畑）の上をひらひら舞う。ときどき花にとまって翅を開閉し、
// 二匹でもつれ合うように舞い上がる組もいる。位置は世界の格子ごとの時間の式（CPUに状態を持たない）
// 種類：モンシロチョウ・モンキチョウ（白い雌も）・アゲハ・ツマキチョウ・ルリシジミ・ベニシジミ。翅の表と裏で模様が違う
// ミツバチ：花から花へ、ホバリングしては素早く移る（同じく格子ごとの時間の式）
import * as THREE from 'three';
import { ALL, SHADOW } from './glsl.js';
import { MeshB } from './creatures_base.js';

const BVS = /* glsl */ `
${ALL}
${SHADOW}
uniform sampler2D tType;
uniform vec2 uCenter;
uniform float uCell;
uniform float uN;
uniform float uDbg;
attribute vec4 aW;   // x=部位(0前翅 1後翅 2胴) y=左右 z,w=翅の上の位置(0..1)
varying vec2 vUv;
varying float vPart;
varying float vKind;
varying float vSex;
varying vec3 vWorld;
varying vec3 vN;
varying float vSh;
float h1(uint h, uint k) { return float(pcg(h + k * 0x9E3779B9u) >> 8u) / 16777216.0; }
void collapse() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
// 花の多さ（地面の種類から）
float flowers(int tc) {
  if (tc == 19) return 1.0;            // 菜の花
  if (tc == 3) return 0.8;             // れんげ
  if (tc == 15) return 0.8;            // 庭の畑（キャベツにモンシロチョウ）
  if (tc == 7 || tc == 18 || tc == 13 || tc == 12) return 0.4; // 野の花の原・土手
  return 0.0;
}
// 種類：0 モンシロ 1 モンキ 2 アゲハ 3 ツマキ 4 ルリシジミ 5 ベニシジミ（花の種類ごとの割合）
float pickKind(int tc, float r) {
  if (tc == 19) return r < 0.42 ? 0.0 : r < 0.57 ? 1.0 : r < 0.77 ? 3.0 : r < 0.87 ? 2.0 : r < 0.94 ? 5.0 : 4.0;
  if (tc == 3) return r < 0.3 ? 1.0 : r < 0.52 ? 0.0 : r < 0.68 ? 5.0 : r < 0.84 ? 4.0 : r < 0.95 ? 3.0 : 2.0;
  if (tc == 15) return r < 0.85 ? 0.0 : r < 0.95 ? 1.0 : 2.0;
  return r < 0.3 ? 5.0 : r < 0.6 ? 4.0 : r < 0.8 ? 0.0 : r < 0.9 ? 1.0 : 3.0;
}
vec3 pathAt(float t, vec3 c, uint hh, float gy, float hmul, float jit) {
  // gy：花の上の高さ（地面＋草丈）
  float r0 = h1(hh, 5u), r1 = h1(hh, 6u), r2 = h1(hh, 7u);
  float w1 = 0.35 + 0.4 * r0, w2 = 0.5 + 0.5 * r1;
  vec3 p = c + vec3(cos(t * w1 + r2 * 6.3) * (1.4 + 1.6 * r1) + sin(t * w2 * 1.7 + r0 * 4.0) * 0.8,
                    0.0,
                    sin(t * w1 * 0.9 + r0 * 6.3) * (1.4 + 1.6 * r0) + cos(t * w2 * 1.3 + r1 * 3.0) * 0.8);
  // 小さな蝶はせわしなく向きを変える
  p.xz += jit * vec2(sin(t * 3.1 + r0 * 9.0), cos(t * 2.7 + r1 * 7.0)) * 0.35;
  // ふわふわ上下する（羽ばたきごとの小さな跳ね）
  p.y = gy + 0.1 + hmul * 0.95 * (0.5 + 0.5 * sin(t * 0.7 + r2 * 9.0)) + 0.12 * hmul * sin(t * 9.0 + r0 * 20.0) + 0.06 * sin(t * 23.0);
  return p;
}
void main() {
  int id = gl_InstanceID;
  int n = int(uN);
  int slot = id % 3;
  int cid = id / 3;
  ivec2 g = ivec2(cid % n, cid / n) - ivec2(n / 2);
  ivec2 cellI = ivec2(floor(uCenter / uCell)) + g;
  uint hh = hashU2(cellI + ivec2(4441, slot * 977));
  vec2 c2 = (vec2(cellI) + 0.5 + (vec2(h1(hh, 1u), h1(hh, 2u)) - 0.5) * 0.8) * uCell;
  int tc = int(texelFetch(tType, worldTexel(c2), 0).x * 255.0 + 0.5);
  float fl = flowers(tc);
  if (fl <= 0.0 || h1(hh, 3u) > fl * (slot == 0 ? 0.95 : slot == 1 ? 0.42 : 0.6)) { collapse(); return; }
  float dist = distance(c2, cameraPosition.xz);
  float fade = 1.0 - smoothstep(34.0, 44.0, dist);
  if (fade <= 0.0) { collapse(); return; }
  // 二匹目（slot 1）は一匹目と同じ種類で、まわりをもつれて舞う。三匹目（slot 2）はひとりで
  uint hp = hashU2(cellI + ivec2(4441, slot == 2 ? 2 * 977 : 0));
  float kind = pickKind(tc, h1(hp, 4u));
  vKind = kind;
  vSex = h1(hp, 15u);
  bool small = kind > 3.5;
  float top = tc == 19 ? 1.0 : tc == 3 ? 0.14 : tc == 15 ? 0.25 : 0.32;
  float gy = heightAt(c2) + top;
  float t = uTime + h1(hh, 8u) * 100.0;
  float hmul = small ? 0.45 : kind > 2.5 ? 0.7 : 1.0;
  float jit = small ? 1.0 : 0.0;
  vec3 p = pathAt(t, vec3(c2.x, 0.0, c2.y), hp, gy, hmul, jit);
  vec3 p2 = pathAt(t + 0.03, vec3(c2.x, 0.0, c2.y), hp, gy, hmul, jit);
  if (slot == 1) {
    float a = t * 5.0;
    p += vec3(cos(a) * 0.18, 0.08 * sin(a * 1.3) + 0.12, sin(a) * 0.18);
    p2 += vec3(cos(a + 0.15) * 0.18, 0.08 * sin((a + 0.15) * 1.3) + 0.12, sin(a + 0.15) * 0.18);
  }
  // 花にとまる：一匹目と三匹目は時々止まって翅を開閉する（シジミは長く、翅を閉じて）
  float rc = fract(t / (16.0 + 10.0 * h1(hp, 9u)) + h1(hp, 10u));
  float rEnd = small ? 0.5 : 0.26;
  float rest = slot != 1 ? smoothstep(0.0, 0.06, rc) * (1.0 - smoothstep(rEnd, rEnd + 0.06, rc)) : 0.0;
  vec2 rp = c2 + (vec2(h1(hp, 11u), h1(hp, 12u)) - 0.5) * uCell * 0.6;
  vec3 restP = vec3(rp.x, heightAt(rp) + top - 0.04, rp.y);
  p = mix(p, restP, rest);
  p2 = mix(p2, restP + vec3(0.01, 0.0, 0.0), rest);
  vec3 v = p2 - p;
  float yaw = atan(v.x, v.z + 1e-6) + rest * (h1(hp, 13u) * 6.28);
  // 羽ばたき：飛ぶときは速く（アゲハは遅め、シジミは速い）、とまると翅をゆっくり開閉
  float fr = kind > 3.5 ? 12.0 : kind > 1.5 && kind < 2.5 ? 6.0 : 9.5;
  float restFlap = small ? 0.9 + 0.1 * sin(t * 0.8) - 0.5 * smoothstep(0.7, 1.0, sin(t * 0.23 + h1(hp, 16u) * 6.0)) : 0.66 + 0.34 * sin(t * 1.4);   // とまると平らに開ききらず、V字〜閉じて立てた形を行き来する
  float flap = mix(sin(t * fr * 6.2831 + h1(hh, 14u) * 6.0) * 0.5 + 0.5, restFlap, rest);
  float ang = mix(0.15, 1.45, flap);   // 翅の開き（0 閉じる〜 上へ）
  float S = (kind > 1.5 && kind < 2.5 ? 0.066 : kind > 3.5 ? 0.016 : kind > 2.5 ? 0.027 : 0.037) * uDbg;  // 翅の長さ（m）（uDbg は確かめ用の拡大）
  int part = int(aW.x + 0.5);
  float side = aW.y;
  vec3 lp;
  vec3 ln;
  if (part == 2) {
    lp = vec3(aW.z * 0.004 - 0.002, aW.w * 0.003 - 0.0015, (aW.w - 0.5) * S * 0.9);
    lp.xy *= S / 0.037;
    ln = vec3(0.0, 1.0, 0.0);
  } else {
    // 翅：体の軸から横へ。前翅は前寄り、後翅は後ろ寄り
    float span = aW.z * S * (part == 0 ? 1.0 : 0.82);
    float along = (part == 0 ? 0.25 - aW.w * 0.85 : -0.1 - aW.w * 0.75) * S * (part == 0 ? 1.0 : 0.9);
    if (kind > 1.5 && kind < 2.5 && part == 1) along -= aW.w * aW.z * 0.2 * S;
    lp = vec3(side * span * cos(1.5708 - ang), span * sin(1.5708 - ang) * 1.0, along);
    ln = normalize(vec3(-sin(1.5708 - ang) * side, cos(1.5708 - ang), 0.0));
  }
  vUv = aW.zw;
  vPart = aW.x;
  float cy = cos(yaw), sy = sin(yaw);
  mat3 R = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  vec3 wp = p + R * lp * fade;
  vWorld = wp;
  vN = R * ln;
  vec4 pf = uShadowFMat * vec4(wp, 1.0);
  vec3 uf = pf.xyz / pf.w;
  vSh = 1.0;
  if (all(greaterThan(uf.xy, vec2(0.0))) && all(lessThan(uf.xy, vec2(1.0))) && uf.z > 0.0 && uf.z < 1.0) vSh = texture(tShadowF, vec3(uf.xy, uf.z - 0.0015 * uShadowP.w));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const BFS = /* glsl */ `
${ALL}
uniform float uDbgF;
varying vec2 vUv;
varying float vPart;
varying float vKind;
varying float vSex;
varying vec3 vWorld;
varying vec3 vN;
varying float vSh;
float disc(vec2 q, vec2 c, float r) { return 1.0 - smoothstep(r * 0.7, r, length(q - c)); }
void main() {
  vec2 q = vUv;   // x=付け根から先（0..1） y=前縁から後縁（0..1）
  int part = int(vPart + 0.5);
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  // 翅の表（背の側）が見えているか
  bool up = dot(N, V) > 0.0;
  vec3 alb;
  float a = 1.0;
  int k = int(vKind + 0.5);
  bool male = vSex < 0.5;
  if (part == 2) {
    alb = k == 2 ? vec3(0.05, 0.04, 0.03) : k == 4 ? vec3(0.2, 0.22, 0.28) : vec3(0.12, 0.12, 0.11);
  } else {
    // 翅の形：前翅は丸みのある三角（ツマキは先がとがって鉤になる）、後翅は丸い
    float r = length(vec2(q.x * 1.05, (q.y - 0.3) * 1.2));
    float fe = r + 0.25 * q.y * q.y;
    if (k == 3) fe = r + 0.3 * q.y * q.y - 0.08 * smoothstep(0.6, 0.9, q.x) * (1.0 - q.y);
    float edge = part == 0 ? 1.0 - smoothstep(0.92, 1.0, fe) : 1.0 - smoothstep(0.86, 0.95, length(vec2(q.x, q.y - 0.45)) * 1.1);
    // アゲハの後翅の尾
    if (k == 2 && part == 1) edge = max(edge, (1.0 - smoothstep(0.04, 0.07, abs(q.x - 0.5 - (q.y - 0.8) * 0.3))) * step(0.78, q.y) * (1.0 - smoothstep(0.96, 1.0, q.y)));
    a = edge;
    // 翅脈：付け根から放射状の細い筋
    float vein = smoothstep(0.08, 0.0, abs(fract(atan(q.y - 0.3, q.x + 0.08) * 4.5) - 0.5)) * smoothstep(0.15, 0.4, q.x);
    if (k == 0) {
      // モンシロチョウ：表は白、前翅の先が黒く斑がふたつ（雌は濃い）。裏の後翅は淡い黄
      alb = vec3(0.92, 0.92, 0.87);
      if (up) {
        if (part == 0) {
          alb = mix(alb, vec3(0.12), smoothstep(0.72, 0.8, q.x) * smoothstep(0.5, 0.2, q.y));
          alb = mix(alb, vec3(0.12), disc(q, vec2(0.55, 0.55), male ? 0.07 : 0.09));
          if (!male) alb = mix(alb, vec3(0.15), disc(q, vec2(0.45, 0.85), 0.07));
        } else alb = mix(alb, vec3(0.15), disc(q, vec2(0.55, 0.15), 0.06));
        alb = mix(alb, vec3(0.6, 0.62, 0.55), smoothstep(0.3, 0.0, q.x) * 0.6);
      } else {
        alb = part == 1 ? vec3(0.9, 0.88, 0.62) : mix(alb, vec3(0.88, 0.86, 0.6), smoothstep(0.6, 0.85, q.x));
        if (part == 0) alb = mix(alb, vec3(0.2), disc(q, vec2(0.55, 0.55), 0.05));
      }
    } else if (k == 1) {
      // モンキチョウ：黄（雌の一部は白っぽい）。縁が黒く、前翅に黒点、後翅に橙の点
      alb = male || vSex > 0.8 ? vec3(0.92, 0.78, 0.2) : vec3(0.88, 0.9, 0.76);
      if (up) {
        alb = mix(alb, vec3(0.15, 0.12, 0.05), smoothstep(0.8, 0.9, length(vec2(q.x, q.y * 0.8))) * 0.9);
        if (part == 0) alb = mix(alb, vec3(0.08), disc(q, vec2(0.45, 0.45), 0.06));
        else alb = mix(alb, vec3(0.85, 0.4, 0.1), disc(q, vec2(0.5, 0.45), 0.06));
      } else {
        alb *= vec3(0.95, 1.0, 0.85);
        alb = mix(alb, vec3(0.75, 0.5, 0.4), disc(q, vec2(0.45, 0.5), 0.05));
        alb = mix(alb, vec3(0.9), disc(q, vec2(0.45, 0.5), 0.025));
      }
    } else if (k == 2) {
      // アゲハ：黄に黒の筋、後翅の端に青と朱の斑
      alb = vec3(0.92, 0.82, 0.35);
      float vv = abs(fract(q.x * 3.5 + q.y * 1.2) - 0.5);
      alb = mix(alb, vec3(0.04), smoothstep(0.12, 0.05, vv) * 0.9);
      alb = mix(alb, vec3(0.04), smoothstep(0.78, 0.86, q.x + q.y * 0.3) * 0.95);
      alb = mix(alb, vec3(0.04), smoothstep(0.25, 0.1, q.y) * (part == 0 ? 0.9 : 0.0));
      if (part == 1) {
        alb = mix(alb, vec3(0.2, 0.35, 0.8), smoothstep(0.06, 0.03, abs(q.x - 0.75)) * smoothstep(0.4, 0.6, q.y));
        alb = mix(alb, vec3(0.85, 0.25, 0.1), disc(q, vec2(0.3, 0.9), 0.08));
        if (q.y > 0.78) alb = vec3(0.05);
      }
      if (!up) alb = mix(alb, vec3(0.8, 0.72, 0.38), 0.3);
    } else if (k == 3) {
      // ツマキチョウ：白、前翅の先は雄だけ橙。裏の後翅は緑がかった雲形の模様
      alb = vec3(0.93, 0.93, 0.9);
      if (part == 0) {
        float tip = smoothstep(0.62, 0.75, q.x) * smoothstep(0.75, 0.35, q.y);
        if (male) alb = mix(alb, vec3(0.95, 0.42, 0.05), tip);
        alb = mix(alb, vec3(0.2), smoothstep(0.86, 0.95, q.x) * smoothstep(0.6, 0.3, q.y) * 0.8);
        alb = mix(alb, vec3(0.1), disc(q, vec2(0.45, 0.45), 0.035));
      } else if (!up) {
        float m = vnoise2(q * 9.0 + vKind * 3.0);
        alb = mix(alb, vec3(0.45, 0.52, 0.3), smoothstep(0.45, 0.6, m) * 0.85);
      }
    } else if (k == 4) {
      // ルリシジミ：表は淡い瑠璃色（雌は黒い縁が太い）、裏は銀白に小さな黒点
      if (up) {
        alb = vec3(0.5, 0.6, 0.95);
        float bw = male ? 0.9 : 0.72;
        alb = mix(alb, vec3(0.08, 0.08, 0.1), smoothstep(bw, bw + 0.06, length(vec2(q.x, q.y * 0.85))));
        alb = mix(alb, vec3(0.92), smoothstep(0.97, 1.0, length(vec2(q.x, q.y * 0.85))));
      } else {
        alb = vec3(0.86, 0.87, 0.9);
        vec2 g = fract(q * vec2(4.0, 3.0)) - 0.5;
        alb = mix(alb, vec3(0.15), (1.0 - smoothstep(0.05, 0.09, length(g))) * step(0.25, q.x) * 0.9);
      }
    } else {
      // ベニシジミ：前翅は赤橙に黒い点と黒茶の縁、後翅は黒茶に橙の帯。裏は淡い
      if (up) {
        if (part == 0) {
          alb = vec3(0.92, 0.42, 0.06);
          alb = mix(alb, vec3(0.2, 0.1, 0.04), smoothstep(0.78, 0.88, length(vec2(q.x, q.y * 0.8))));
          vec2 g = fract(q * vec2(3.0, 2.5) + 0.3) - 0.5;
          alb = mix(alb, vec3(0.05), (1.0 - smoothstep(0.08, 0.13, length(g))) * step(0.2, q.x) * step(q.x, 0.78));
        } else {
          alb = vec3(0.16, 0.09, 0.05);
          alb = mix(alb, vec3(0.92, 0.42, 0.06), smoothstep(0.1, 0.03, abs(length(vec2(q.x, q.y - 0.45)) * 1.1 - 0.72)));
        }
      } else {
        alb = part == 0 ? vec3(0.9, 0.62, 0.35) : vec3(0.7, 0.66, 0.58);
        vec2 g = fract(q * vec2(3.0, 2.5)) - 0.5;
        alb = mix(alb, vec3(0.2), (1.0 - smoothstep(0.05, 0.08, length(g))) * 0.7);
      }
    }
    alb *= 1.0 - vein * 0.18;
  }
  if (a < 0.4) discard;
  if (!up) N = -N;
  float nl = dot(N, uSunDir);
  vec3 col = alb * (uSunCol * (0.35 + 0.65 * max(nl, 0.0)) * vSh + shIrr(N));
  // 翅は薄くて透ける
  col += alb * uSunCol * pow(sat(dot(-V, uSunDir)), 2.0) * 0.7 * vSh;
  // 鱗粉のにぶい艶（ルリシジミの表はきらりと青い）
  vec3 H = normalize(uSunDir + V);
  float sp = pow(max(dot(N, H), 0.0), k == 4 && up ? 18.0 : 30.0);
  col += uSunCol * sp * (k == 4 && up ? vec3(0.25, 0.35, 0.8) : vec3(0.06)) * vSh;
  gl_FragColor = vec4(col, 1.0);
  if (uDbgF > 0.5) gl_FragColor = vec4(8.0, 0.0, 8.0, 1.0);   // 確かめ用：目立つ色
}
`;

export class Butterflies {
  constructor(shared, textures) {
    // 1匹：前翅・後翅（左右）＋胴
    const W = [], idx = [];
    const quad = (part, side, nu, nv) => {
      const base = W.length / 4;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) W.push(part, side, i / nu, j / nv);
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i; idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1); }
    };
    for (const side of [-1, 1]) { quad(0, side, 3, 3); quad(1, side, 3, 4); }
    quad(2, 1, 1, 3);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 4));
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((W.length / 4) * 3), 3));
    g.setIndex(idx);
    this.n = 34;
    this.cell = 2.6;
    g.instanceCount = this.n * this.n * 3;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, tType: textures.tType, uCenter: { value: new THREE.Vector2() }, uCell: { value: this.cell }, uN: { value: this.n }, uDbg: { value: 1 }, uDbgF: { value: 0 } },
      vertexShader: BVS, fragmentShader: BFS, side: THREE.DoubleSide, alphaToCoverage: true,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    // ミツバチ（同じ入れ物にぶら下げる：蝶の群を消すと一緒に消える）
    this.bees = new Bees(shared, textures);
    this.mesh.add(this.bees.mesh);
  }
  update(camera) {
    const snap = this.cell * 2;
    this.mat.uniforms.uCenter.value.set(Math.round(camera.position.x / snap) * snap, Math.round(camera.position.z / snap) * snap);
    this.bees.update(camera);
  }
}

// ---- ミツバチ ----
const EVS = /* glsl */ `
${ALL}
${SHADOW}
uniform sampler2D tType;
uniform vec2 uCenter;
uniform float uCell;
uniform float uN;
uniform float uDbg;
attribute vec3 aCol;
attribute vec4 aPart;   // x=部位(0 体 1 翅) z=左右
varying vec3 vCol;
varying vec3 vN;
varying vec3 vWorld;
varying float vSh;
varying float vWing;
float h1(uint h, uint k) { return float(pcg(h + k * 0x9E3779B9u) >> 8u) / 16777216.0; }
void collapse() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
float bloom(int tc) {
  if (tc == 19) return 1.0;   // 菜の花
  if (tc == 3) return 0.85;   // れんげ（蜜源）
  if (tc == 15) return 0.35;
  if (tc == 7 || tc == 18 || tc == 12) return 0.18;
  return 0.0;
}
vec3 flowerAt(ivec2 cellI, int sl, float k, float top) {
  uint h = hashU2(cellI * 7 + ivec2(int(k) * 131 + 7 + sl * 3, int(k) * 17 + 3));
  vec2 p = (vec2(cellI) + 0.1 + 0.8 * vec2(h1(h, 1u), h1(h, 2u))) * uCell;
  return vec3(p.x, heightAt(p) + top * (0.8 + 0.25 * h1(h, 3u)), p.y);
}
void main() {
  int id = gl_InstanceID;
  int n = int(uN);
  int slot = id % 2;
  int cid = id / 2;
  ivec2 g = ivec2(cid % n, cid / n) - ivec2(n / 2);
  ivec2 cellI = ivec2(floor(uCenter / uCell)) + g;
  uint hh = hashU2(cellI + ivec2(8123, slot * 613));
  vec2 c2 = (vec2(cellI) + 0.5) * uCell;
  int tc = int(texelFetch(tType, worldTexel(c2), 0).x * 255.0 + 0.5);
  float bl = bloom(tc);
  if (bl <= 0.0 || h1(hh, 3u) > bl * (slot == 0 ? 0.9 : 0.55)) { collapse(); return; }
  float dist = distance(c2, cameraPosition.xz);
  float fade = 1.0 - smoothstep(16.0, 20.0, dist);
  if (fade <= 0.0) { collapse(); return; }
  float top = tc == 19 ? 1.0 : tc == 3 ? 0.13 : tc == 15 ? 0.22 : 0.28;
  // 花から花へ：一輪に 1.2〜2 秒とどまり、0.35 秒で次へ
  float T = 1.7 + 0.8 * h1(hh, 4u);
  float t = uTime / T + h1(hh, 5u) * 50.0;
  float k = floor(t), u = fract(t);
  vec3 A = flowerAt(cellI, slot, k, top), B = flowerAt(cellI, slot, k + 1.0, top);
  float fly = smoothstep(0.78, 1.0, u);
  vec3 p = mix(A, B, fly) + vec3(0.0, 0.06 + 0.12 * sin(3.1416 * fly), 0.0);
  float tt = uTime + h1(hh, 6u) * 10.0;
  // 花の上ではホバリングして小さく揺れ、ときどき花にもぐる
  float hover = 1.0 - fly;
  p += hover * vec3(sin(tt * 6.3) * 0.012, 0.01 * sin(tt * 9.0) - 0.035 * smoothstep(0.35, 0.5, u) * (1.0 - smoothstep(0.6, 0.72, u)), cos(tt * 5.1) * 0.012);
  vec3 d = B - A;
  float yaw = mix(atan(d.x, d.z + 1e-6) + sin(tt * 1.3) * 0.6 * hover, atan(d.x, d.z + 1e-6), fly);
  vec3 lp = position;
  vec3 ln = normal;
  vWing = 0.0;
  if (aPart.x > 0.5) {
    // 翅：速い羽ばたきはぶれて見えるので、決まった開きの半透明の面（網目に間引いて描く）にする
    float a = 0.35 * aPart.z;
    float c = cos(a), s = sin(a);
    vec3 o = vec3(0.0008 * aPart.z, 0.0024, 0.0);
    vec3 q = lp - o;
    lp = o + vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z);
    vWing = 1.0;
  }
  float cy = cos(yaw), sy = sin(yaw);
  mat3 R = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  // 飛ぶときは少し前へ傾く
  float pit = 0.25 * fly + 0.1;
  mat3 P = mat3(1.0, 0.0, 0.0, 0.0, cos(pit), -sin(pit), 0.0, sin(pit), cos(pit));
  vec3 wp = p + R * (P * lp) * fade * uDbg;
  vWorld = wp;
  vN = R * (P * ln);
  vCol = aCol;
  vec4 pf = uShadowFMat * vec4(wp, 1.0);
  vec3 uf = pf.xyz / pf.w;
  vSh = 1.0;
  if (all(greaterThan(uf.xy, vec2(0.0))) && all(lessThan(uf.xy, vec2(1.0))) && uf.z > 0.0 && uf.z < 1.0) vSh = texture(tShadowF, vec3(uf.xy, uf.z - 0.0015 * uShadowP.w));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const EFS = /* glsl */ `
${ALL}
varying vec3 vCol;
varying vec3 vN;
varying vec3 vWorld;
varying float vSh;
varying float vWing;
void main() {
  vec3 N = vN;
  float l = length(N);
  N = l > 1e-5 ? N / l : vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float nl = dot(N, uSunDir);
  // 翅は画面の網目で半分を抜いて、向こうが透けて見える薄い膜にする（コマごとに変わらないのでちらつかない）
  if (vWing > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
  vec3 col = vCol * (uSunCol * sat((nl + 0.3) / 1.3) * vSh + shIrr(N));
  if (vWing > 0.5) col = mix(col, shIrr(reflect(-V, N)) * 0.9 + uSunCol * 0.15 * vSh, 0.55);
  // 毛の縁の照り
  col += vCol * uSunCol * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.4 * vSh;
  gl_FragColor = vec4(col, 1.0);
}
`;
class Bees {
  constructor(shared, textures) {
    const m = new MeshB();
    const amber = [0.55, 0.32, 0.06], black = [0.05, 0.035, 0.02], fuzz = [0.42, 0.3, 0.14];
    // 頭・胸（毛深い）・腹（黄と黒の縞）
    m.ellipsoid([0, 0.0005, 0.0048], [0.0017, 0.0017, 0.0015], 6, 5, () => black, () => [0, 0, 0, 0]);
    m.ellipsoid([0, 0.0008, 0.0022], [0.0021, 0.0021, 0.0021], 7, 6, () => fuzz, () => [0, 0, 0, 0]);
    m.ellipsoid([0, 0.0, -0.0022], [0.0021, 0.002, 0.0038], 8, 8, (v, th, p) => (Math.sin(p[2] * 1500) > 0.2 ? black : amber), () => [0, 0, 0, 0]);
    // 翅：透明がかった二枚
    for (const sx of [-1, 1]) m.fan([sx * 0.0008, 0.0024, 0.002], [[sx * 0.0008, 0.0024, 0.0032], [sx * 0.004, 0.0028, 0.0026], [sx * 0.0068, 0.0029, 0.0006], [sx * 0.0072, 0.0027, -0.0012], [sx * 0.005, 0.0025, -0.002], [sx * 0.0008, 0.0024, 0.0008]], [0, 1, 0], () => [0.7, 0.72, 0.75], () => [1, 0, sx, 0]);
    const g = m.build();
    this.n = 24;
    this.cell = 1.6;
    g.instanceCount = this.n * this.n * 2;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, tType: textures.tType, uCenter: { value: new THREE.Vector2() }, uCell: { value: this.cell }, uN: { value: this.n }, uDbg: { value: 1 } },
      vertexShader: EVS, fragmentShader: EFS, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
  }
  update(camera) {
    const snap = this.cell * 2;
    this.mat.uniforms.uCenter.value.set(Math.round(camera.position.x / snap) * snap, Math.round(camera.position.z / snap) * snap);
  }
}
