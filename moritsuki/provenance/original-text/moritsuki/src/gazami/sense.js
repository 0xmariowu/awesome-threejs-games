// 砂の上に見せるもの
// ・カニの青い輪郭: 「いてっ」と触れたカニの甲羅・ハサミ・脚を、砂の上に光る線で浮かべる（向き＝ハサミの側がわかる）
// ・ねらいの輪: 右クリックで手を突っ込む所
// ・手を突っ込んだ跡: 小さなくぼみ（しばらくで消える）
// どれも水の下の砂に置くので、水面の処理で屈折して見える
import * as THREE from 'three';
import { U, COMMON_GLSL } from './shade.js';
import { crabShape } from './crabs.js';

const SPAN = { taiwan: 2.5, ishi: 2.5, taraba: 4.4 }; // 輪郭の絵の一辺（甲羅の幅に対して）。タラバガニは脚が長い

// 輪郭の絵: 甲羅の縁・眼・たたんだハサミ・脚を、にじんだ白い線で（色はシェーダーで付ける）
const texCache = {};
function outlineTex(model) {
  if (texCache[model]) return texCache[model];
  const S = crabShape(model);
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const k = N / SPAN[model];
  const lw = Math.sqrt(2.5 / SPAN[model]); // 絵が大きい分、線は細めに
  const P = (x, z) => [N / 2 - x * k, N / 2 - z * k]; // 画像の上 = 前（+z）
  g.lineJoin = 'round'; g.lineCap = 'round';
  // 甲羅の中をうすく塗る
  const path = () => { g.beginPath(); S.ring.forEach(([x, z], i) => { const [px, py] = P(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); };
  path();
  g.fillStyle = 'rgba(255,255,255,0.13)';
  g.fill();
  // 脚（細い線）: 付け根から外へ、節で折れる
  const limb = (pts, w) => {
    g.beginPath();
    pts.forEach(([x, z], i) => { const [px, py] = P(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.lineWidth = w; g.stroke();
  };
  const Lz = S.Wz;
  // タラバガニ: 長い歩脚 3 対（ひざで少し曲がる）と、顔の前にたたんだ左右ちがう大きさのハサミ
  const kingLegs = (w, a) => {
    g.strokeStyle = `rgba(255,255,255,${a})`;
    for (const side of [1, -1]) {
      S.legs.walk.forEach(([ax, az], i) => {
        const b = [side * ax * 0.5, az * Lz];
        const dir = S.legFwd[i] * 0.85;
        const ux = side * Math.cos(dir), uz = Math.sin(dir);
        const bend = [0.06, 0, -0.08][i];
        const m1 = [b[0] + ux * 0.1, b[1] + uz * 0.1];
        const k1 = [m1[0] + ux * 0.62, m1[1] + uz * 0.62];
        const k2 = [k1[0] + ux * 0.3, k1[1] + uz * 0.3 + bend];
        const f = [k2[0] + side * Math.cos(dir * 1.2) * 0.42, k2[1] + Math.sin(dir * 1.2) * 0.42 + bend * 2];
        limb([b, m1, k1], w * 1.5);
        limb([k1, k2, f], w * 1.2);
      });
      const [cx, cz] = S.legs.cheliped;
      const big = side === -1 ? 1.25 : 0.85;
      const c0 = [side * cx * 0.5, cz * Lz];
      const c1 = [c0[0] + side * 0.16, c0[1] + 0.2];
      const c2 = [c1[0] - side * 0.02, c1[1] + 0.12];
      const c3 = [c2[0] - side * 0.2 * big, c2[1] + 0.03];
      const c4 = [c3[0] - side * 0.1 * big, c3[1] - 0.02];
      limb([c0, c1, c2], w * 1.6);
      limb([c2, c3], w * 3.6 * big);
      limb([c3, c4], w * 1.5 * big);
      limb([c3, [c4[0] + side * 0.02, c4[1] - 0.05]], w * 1.5 * big);
    }
  };
  const legsDraw = (w, a) => {
    if (S.king) return kingLegs(w, a);
    g.strokeStyle = `rgba(255,255,255,${a})`;
    for (const side of [1, -1]) {
      S.legs.walk.forEach(([ax, az], i) => {
        const bx = side * ax * 0.5, bz = az * Lz;
        const dir = [0.35, -0.05, -0.45][i];
        const m = [bx + side * Math.cos(dir) * 0.28, bz + Math.sin(dir) * 0.28];
        const e = [m[0] + side * Math.cos(dir - 0.5 * side * 0) * 0.16, m[1] + Math.sin(dir) * 0.16 - 0.06];
        limb([[bx, bz], m, e], w);
      });
      const [sx, sz] = S.legs.swim;
      const b = [side * sx * 0.5, sz * Lz];
      const m = [b[0] + side * 0.14, b[1] - 0.13];
      limb([b, m, [m[0] + side * 0.02, m[1] - 0.12]], w * 1.4);
      // ハサミ: 長節は前外へ、腕節で内へ折れ、掌と指は前内を向く（たたんで顔の前に構えた形）
      const [cx, cz] = S.legs.cheliped;
      const c0 = [side * cx * 0.5, cz * Lz];
      const c1 = [c0[0] + side * 0.2, c0[1] + 0.12];
      const c2 = [c1[0] - side * 0.03, c1[1] + 0.12];
      const c3 = [c2[0] - side * 0.11, c2[1] + 0.07];
      const c4 = [c3[0] - side * 0.1, c3[1] + 0.07];
      limb([c0, c1, c2], w * 1.7);
      limb([c2, c3], w * 3.4);
      // 指（少し開いた V）
      limb([c3, c4], w * 1.5);
      limb([c3, [c4[0] + side * 0.03, c4[1] - 0.035]], w * 1.5);
    }
  };
  // にじみ（太くうすい線を重ねる）→ 芯
  g.shadowColor = 'rgba(255,255,255,0.9)';
  for (const [w, a, blur] of [[14, 0.12, 16], [7, 0.3, 8], [3.2, 0.95, 3]]) {
    g.shadowBlur = blur * lw;
    legsDraw(w * 0.5 * lw, a * 0.8);
    path();
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = w * lw;
    g.stroke();
  }
  // 眼
  g.shadowBlur = 6;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (const side of [1, -1]) { const [px, py] = P(side * S.eye[0] * 0.5, S.eye[1] * Lz + 0.01); g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  texCache[model] = t;
  return t;
}

const OUT_VS = /* glsl */ `
  varying vec2 vUv; varying vec3 vWP;
  void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`;
const OUT_FS = /* glsl */ `
  ${COMMON_GLSL}
  uniform sampler2D tMap; uniform float uAge; uniform float uLife; uniform float uK; uniform vec3 uCol; uniform float uWarn;
  varying vec2 vUv; varying vec3 vWP;
  void main() {
    vec4 tx = texture2D(tMap, vUv);
    float a = tx.a * tx.r;
    // 現れるとき: 中心から広がる光の輪が線をなぞる
    vec2 c = vUv - 0.5;
    float r = length(c);
    float front = uAge * 1.6;
    float reveal = smoothstep(front, front - 0.12, r);
    float ring = exp(-pow((r - front) / 0.03, 2.0)) * step(uAge, 0.5);
    float fade = 1.0 - smoothstep(uLife - 1.1, uLife, uAge);
    float pulse = 0.85 + 0.15 * sin(uTime * 7.0 + r * 30.0);
    // ハサミの側は、危ないので少し橙に（uWarn）
    vec3 col = mix(uCol, vec3(1.0, 0.55, 0.25), uWarn * smoothstep(0.02, 0.2, -c.y) * 0.0);
    vec3 o = col * (a * reveal * pulse + ring * 0.25 * smoothstep(0.5, 0.1, r)) * fade * uK;
    gl_FragColor = vec4(o, 1.0);
  }
`;

export class Sense {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...U, tMap: { value: null }, uAge: { value: 0 }, uLife: { value: 3 }, uK: { value: 1 }, uCol: { value: new THREE.Color(0.45, 1.25, 2.8) }, uWarn: { value: 0 } },
        vertexShader: OUT_VS, fragmentShader: OUT_FS,
        // 手の下にもぐっていても見えるように（手ざわりで「わかる」輪郭なので、手の上にも重ねて描く）
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 6;
      m.frustumCulled = false;
      scene.add(m);
      this.pool.push(m);
    }
    this.buildReticle();
    this.buildHoles();
  }

  /** カニ it の輪郭を出す（出ていれば出し直す） */
  reveal(it, life = 3.4) {
    let o = this.active.find((a) => a.it === it);
    if (!o) {
      let m = this.pool.find((p) => !p.visible);
      if (!m) { const old = this.active.shift(); old.m.visible = false; m = old.m; }
      o = { it, m, age: 0 };
      this.active.push(o);
      m.visible = true;
      m.material.uniforms.tMap.value = outlineTex(it.sp.model);
      // レジェンドは金色に光る
      m.material.uniforms.uCol.value.setRGB(...(it.sp.legend ? [2.6, 1.55, 0.35] : [0.45, 1.25, 2.8]));
    } else o.age = Math.min(o.age, 0.4);
    o.life = life;
    return o;
  }
  isRevealed(it) { const o = this.active.find((a) => a.it === it); return !!o && o.age < o.life - 0.3; }
  hide(it) {
    const o = this.active.find((a) => a.it === it);
    if (o) o.age = Math.max(o.age, o.life - 0.35);
  }
  clear() { for (const o of this.active) o.m.visible = false; this.active = []; }

  update(dt, groundAt) {
    for (const o of [...this.active]) {
      o.age += dt;
      const it = o.it, m = o.m, u = m.material.uniforms;
      if (o.age > o.life || (!it.alive && !it.caught)) { m.visible = false; this.active.splice(this.active.indexOf(o), 1); continue; }
      const W = it.cm / 100;
      m.position.set(it.x, groundAt(it.x, it.z) + 0.004, it.z);
      m.rotation.set(0, it.yaw + Math.PI, 0);
      m.scale.set(W * SPAN[it.sp.model], 1, W * SPAN[it.sp.model]);
      u.uAge.value = o.age; u.uLife.value = o.life;
      u.uK.value = it.move ? 1.3 : 1;
    }
    this.updateReticle(dt, groundAt);
    this.updateHoles(dt);
  }

  // ───── ねらいの輪 ─────
  buildReticle() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uHot: { value: 0 }, uK: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        uniform float uHot; uniform float uK;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float ring = exp(-pow((r - 0.62) / 0.05, 2.0));
          // 4 つの切れ目
          ring *= smoothstep(0.1, 0.3, abs(sin(a * 2.0 + uTime * 0.8 * uHot)));
          float dot0 = exp(-r * r / 0.012);
          vec3 cold = vec3(0.75, 0.85, 1.0);
          vec3 hot = vec3(1.0, 0.72, 0.3);
          vec3 col = mix(cold, hot, uHot) * (ring + dot0 * 0.7) * (0.6 + uHot * (0.5 + 0.3 * sin(uTime * 10.0)));
          gl_FragColor = vec4(col * uK, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12).rotateX(-Math.PI / 2), mat);
    this.reticle.visible = false;
    this.reticle.renderOrder = 5;
    this.reticle.frustumCulled = false;
    this.scene.add(this.reticle);
    this.ret = { x: 0, z: 0, on: 0, hot: 0, want: false, wantHot: 0 };
  }
  setReticle(on, x = 0, z = 0, hot = 0) { const r = this.ret; r.want = on; if (on) { r.x = x; r.z = z; } r.wantHot = hot; }
  updateReticle(dt, groundAt) {
    const r = this.ret, m = this.reticle;
    r.on += ((r.want ? 1 : 0) - r.on) * (1 - Math.exp(-10 * dt));
    r.hot += (r.wantHot - r.hot) * (1 - Math.exp(-12 * dt));
    m.visible = r.on > 0.02;
    if (!m.visible) return;
    m.position.set(r.x, groundAt(r.x, r.z) + 0.006, r.z);
    const s = 1 + r.hot * 0.35;
    m.scale.set(s, 1, s);
    m.material.uniforms.uHot.value = r.hot;
    m.material.uniforms.uK.value = r.on;
  }

  // ───── 手を突っ込んだ跡 ─────
  buildHoles() {
    const MAX = 40;
    const geo = new THREE.PlaneGeometry(0.16, 0.16).rotateX(-Math.PI / 2);
    this.holeInfo = new Float32Array(MAX * 2);
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(this.holeInfo, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U },
      vertexShader: `attribute vec2 aInfo; varying vec2 vUv; varying vec2 vInfo; void main(){ vUv = uv; vInfo = aInfo; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${COMMON_GLSL}
        varying vec2 vUv; varying vec2 vInfo;
        void main() {
          float age = uTime - vInfo.x;
          float fade = 1.0 - smoothstep(12.0, 30.0, age);
          vec2 p = (vUv - 0.5) * 2.0;
          p.x *= 1.0 + 0.15 * sin(vInfo.y * 9.0);
          float r = length(p) * (1.0 + 0.12 * hm_vn(p * 3.0 + vInfo.y * 7.0));
          float dark = smoothstep(0.62, 0.15, r);
          float rim = exp(-pow((r - 0.75) / 0.12, 2.0));
          float a = (dark * 0.55 + rim * 0.2) * fade;
          if (a < 0.01) discard;
          vec3 col = mix(vec3(0.62, 0.57, 0.46), vec3(0.12, 0.1, 0.08), dark / max(dark + rim, 1e-3));
          gl_FragColor = vec4(col * 0.35, a);
        }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.holes = new THREE.InstancedMesh(geo, mat, MAX);
    this.holes.count = 0;
    this.holes.frustumCulled = false;
    this.holes.renderOrder = 2;
    this.scene.add(this.holes);
    this.holeI = 0;
    this.holeMax = MAX;
  }
  hole(x, y, z) {
    const k = this.holeI++ % this.holeMax;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.002, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + Math.random() * 0.4));
    this.holes.setMatrixAt(k, m);
    this.holeInfo.set([U.uTime.value, Math.random()], k * 2);
    this.holes.count = Math.min(this.holeI, this.holeMax);
    this.holes.instanceMatrix.needsUpdate = true;
    this.holes.geometry.attributes.aInfo.needsUpdate = true;
  }
  clearHoles() { this.holeI = 0; this.holes.count = 0; }
  updateHoles() {}
}
