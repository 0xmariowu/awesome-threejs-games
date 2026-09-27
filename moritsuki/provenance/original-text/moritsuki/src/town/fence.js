// 進入禁止の輪: ファストトラベル先（地名）のまわりだけ歩けるようにする。
// 歩ける所は「範囲」（円 { x, z, r } か、向きのある長方形 { x, z, ux, uz, hw, hd }）を合わせた所。その境目に、地面から立ちのぼる赤いもやの光の幕と、
// 舞い上がる火の粉を出す。遠くではうっすら、近づくほどはっきり見え、押し当てると波紋が広がる。
// メニューの「進入禁止を解除」で消える（free = true）。
import * as THREE from 'three';

export const FENCE_R = 25;   // 地名の立つ所からの半径
const WALL_H = 6.5;          // 幕の高さ（地面から）
const STEP = 0.5;            // 幕の刻み（m）

const NOISE = /* glsl */ `
  float fhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(fhash(i), fhash(i + vec3(1, 0, 0)), f.x), mix(fhash(i + vec3(0, 1, 0)), fhash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(fhash(i + vec3(0, 0, 1)), fhash(i + vec3(1, 0, 1)), f.x), mix(fhash(i + vec3(0, 1, 1)), fhash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.7) * 0.15; }
`;

// 見え方は幕と火の粉で共通: 歩いているときは主人公が 2 m ほどまで近づいた所だけ出る（圧迫感を出さない）。空からは全部の輪が見える
const VIS = /* glsl */ `
  uniform vec3 uPlayer;
  uniform float uSky, uAlpha;
  float fenceVis(vec3 w) {
    float d = length(w.xz - uPlayer.xz);
    float near = 1.0 - smoothstep(0.7, 2.2, d);
    // 遠すぎる輪は数ピクセルに縮んで重なり、白く飛ぶので消す
    float cam = 1.0 - smoothstep(650.0, 1000.0, length(cameraPosition - w));
    return max(near, uSky * 0.75) * uAlpha * cam;
  }
`;

// 範囲のふちからの距離（内側は負）
function sdf(c, x, z) {
  const dx = x - c.x, dz = z - c.z;
  if (c.r != null) return Math.hypot(dx, dz) - c.r;
  const qa = Math.abs(dx * c.ux + dz * c.uz) - c.hw, qb = Math.abs(dz * c.ux - dx * c.uz) - c.hd;
  return Math.hypot(Math.max(qa, 0), Math.max(qb, 0)) + Math.min(Math.max(qa, qb), 0);
}
// 範囲の外の点から、いちばん近いふちの点（わずかに内側）
function nearest(c, x, z) {
  const dx = x - c.x, dz = z - c.z;
  if (c.r != null) { const d = Math.hypot(dx, dz), k = (c.r - 1e-3) / d; return [c.x + dx * k, c.z + dz * k]; }
  const cl = (v, m) => Math.max(-m + 1e-3, Math.min(m - 1e-3, v));
  const a = cl(dx * c.ux + dz * c.uz, c.hw), b = cl(dz * c.ux - dx * c.uz, c.hd);
  return [c.x + c.ux * a - c.uz * b, c.z + c.uz * a + c.ux * b];
}
// ふちの線: [{ x, z, nx, nz, cap }] の並び。(nx, nz) は外向き、cap は内側へ入れる深さの上限
function outline(c) {
  if (c.r != null) {
    const n = Math.ceil((Math.PI * 2 * c.r) / STEP), path = [];
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      path.push({ x: c.x + nx * c.r, z: c.z + nz * c.r, nx, nz, cap: c.r });
    }
    return [path];
  }
  const { ux, uz, hw, hd } = c, W = (a, b) => [c.x + ux * a - uz * b, c.z + uz * a + ux * b];
  const lim = Math.min(hw, hd);
  // 4 辺: 始点・終点（ローカル）と外向き（ローカル）
  return [[[-hw, hd], [hw, hd], [0, 1]], [[hw, hd], [hw, -hd], [1, 0]], [[hw, -hd], [-hw, -hd], [0, -1]], [[-hw, -hd], [-hw, hd], [-1, 0]]].map(([A, B, [na, nb]]) => {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.ceil(len / STEP), path = [];
    const nx = ux * na - uz * nb, nz = uz * na + ux * nb;
    for (let k = 0; k <= n; k++) {
      const f = k / n, [x, z] = W(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f);
      path.push({ x, z, nx, nz, cap: Math.min(lim, f * len, (1 - f) * len) });
    }
    return path;
  });
}

export class Fence {
  // ground(x, z): 地形の高さ、groundAt(x, z): 橋・岸壁の上面も含めた高さ
  constructor({ ground, groundAt }) {
    this.ground = ground; this.groundAt = groundAt;
    this.pins = [];          // 地名のまわり [{ x, z, r }]
    this.extra = null;       // 解除中に歩いた先で禁止に戻したとき、その場所のまわり
    this.free = false;
    this.alpha = 0;          // 幕の出し入れ（解除・禁止の切り替えでふわっと）
    this.push = 0;           // 押し当てている強さ
    this.pushPos = new THREE.Vector3(0, -999, 0);
    this.group = new THREE.Group();
    this.group.userData.noAO = true;
    this.uniforms = {
      uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, uSky: { value: 0 }, uAlpha: { value: 0 },
      uPush: { value: 0 }, uPushPos: { value: this.pushPos }, uPx: { value: 400 },
    };
    this.wallMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */ `
        attribute float aH;
        attribute float aVis;
        attribute vec2 aN;
        varying vec3 vW;
        varying float vH, vVis;
        varying vec2 vN;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vH = aH; vVis = aVis; vN = aN;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uPush;
        uniform vec3 uPushPos;
        varying vec3 vW;
        varying float vH, vVis;
        varying vec2 vN;
        ${NOISE}
        ${VIS}
        void main() {
          float vis = fenceVis(vW) * vVis;
          if (vis < 0.003) discard;
          float h = clamp(vH, -0.2, 20.0);
          // もや: 横に流れる大きなむらと、上へ昇る細い筋
          vec3 q = vec3(vW.x * 0.32, vW.y * 0.42 - uTime * 0.55, vW.z * 0.32);
          float cloud = fbm(q + vec3(uTime * 0.04, 0.0, -uTime * 0.03));
          float streak = fbm(vec3(vW.x * 1.35, vW.y * 0.16 - uTime * 0.42, vW.z * 1.35));
          float mist = smoothstep(0.35, 0.8, cloud) * 0.75 + smoothstep(0.5, 0.82, streak) * 0.7;
          // 高さ: 地面ぎわが濃く、上ほど薄れて、もやの切れ目で上端がほどける
          float top = WALL_H_ * (0.55 + 0.45 * cloud);
          float vert = exp(-h * 0.35) * (1.0 - smoothstep(top * 0.4, top, h)) * smoothstep(-0.2, 0.15, h);
          float a = vert * (0.12 + mist);
          // 地面に落ちる光の線（光の輪）
          float line = exp(-max(h, 0.0) * 9.0) * (0.7 + 0.3 * sin(uTime * 2.1 + streak * 6.0));
          // 横から見るほど厚く（幕を斜めに見ると重なって見える）。外側から見るときは控えめに
          vec3 V = normalize(cameraPosition - vW);
          float nv = dot(vec3(vN.x, 0.0, vN.y), V);
          float thick = min(2.2, 0.45 / max(abs(nv), 0.2)) + 0.4;
          float side = nv > 0.0 ? 0.45 : 1.0;
          // カメラのすぐ前は消す（主人公の後ろに回り込んだとき画面がふさがらないように）
          float camD = length(cameraPosition - vW);
          float nearCam = smoothstep(0.6, 3.0, camD);
          // 押し当てたところから広がる波紋
          float pd = length(vW - uPushPos);
          float ripple = 0.5 + 0.5 * sin(pd * 3.2 - uTime * 8.0);
          float hit = uPush * exp(-pd * 0.75) * (0.3 + 0.9 * ripple * ripple) * (1.0 - smoothstep(2.0, 5.5, h));
          float k = vis * nearCam * side;
          float dens = min(0.62, (a * thick * 0.6 + hit * 0.28) * k);
          float glow = (line + hit * 0.6 + a * 0.2) * k;
          vec3 mistCol = mix(vec3(0.85, 0.035, 0.03), vec3(1.2, 0.09, 0.05), clamp(1.0 - h * 0.4, 0.0, 1.0));
          vec3 hot = vec3(1.35, 0.09, 0.05);
          #ifdef ABSORB
            gl_FragColor = vec4(1.0 - dens * vec3(0.12, 0.72, 0.68), 1.0);
          #else
            gl_FragColor = vec4(min(mistCol * dens * 0.55 + hot * glow, vec3(3.0)), 1.0);
          #endif
        }`.replace('WALL_H_', WALL_H.toFixed(2)),
    });
    this.sparkMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */ `
        uniform float uTime, uPx;
        attribute vec4 aSeed;
        attribute vec2 aN;
        varying float vA;
        ${VIS}
        void main() {
          float life = fract(uTime * (0.08 + 0.1 * aSeed.y) + aSeed.x);
          vec3 p = position;
          p.y += life * (1.5 + 4.5 * aSeed.z);
          // ゆらゆらしながら少し内側へ流れる
          float sw = sin(uTime * (0.7 + aSeed.w) + aSeed.x * 40.0) * 0.35 * life;
          p.xz += vec2(-aN.y, aN.x) * sw - aN * life * (0.3 + 0.6 * aSeed.w);
          vA = fenceVis(p) * sin(3.14159 * life) * (0.5 + 0.5 * sin(uTime * 9.0 + aSeed.x * 90.0));
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vA < 0.004 ? 0.0 : clamp(uPx * (0.035 + 0.03 * aSeed.z) / -mv.z, 1.0, 14.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = dot(c, c) * 4.0;
          if (r > 1.0) discard;
          float k = exp(-r * 3.5);
          gl_FragColor = vec4(mix(vec3(1.0, 0.1, 0.04), vec3(1.0, 0.35, 0.2), k) * 1.6, k * vA);
        }`,
    });
    // 地面の光の輪（境目から内側へ 1.6m ほど、ぼんやり赤く照らす）
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: /* glsl */ `
        attribute float aIn;
        attribute float aVis;
        varying vec3 vW;
        varying float vIn, vVis;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vIn = aIn; vVis = aVis;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uPush;
        uniform vec3 uPushPos;
        varying vec3 vW;
        varying float vIn, vVis;
        ${NOISE}
        ${VIS}
        void main() {
          float vis = fenceVis(vW) * vVis;
          if (vis < 0.003) discard;
          // MSAA では細い三角形の外まで値が引き伸ばされて負になることがある（exp が跳ねて白く飛ぶ）
          float vi = clamp(vIn, 0.0, 7.0);
          float n = fbm(vec3(vW.x * 0.6, uTime * 0.35, vW.z * 0.6));
          float edge = exp(-vi * 7.0);                       // 境目の細い光
          float haze = exp(-vi * 2.0) * (0.35 + 0.65 * n);   // 内側へにじむ赤
          float pd = length(vW.xz - uPushPos.xz);
          float hit = uPush * exp(-pd * 0.6) * (0.6 + 0.4 * sin(pd * 4.0 - uTime * 8.0));
          // 空から見るときは太い帯にして、降りられる輪がわかるように
          float band = uSky * (1.0 - smoothstep(3.5, 7.0, vi)) * (0.7 + 0.3 * n);
          float dens = min(0.6, (haze * 0.16 + edge * 0.3 + hit * 0.2 + band * 0.6) * vis);
          vec3 col = vec3(0.9, 0.04, 0.03) * dens * 0.55 + vec3(1.3, 0.07, 0.04) * (edge * 0.9 + hit * 0.5 + band * 0.6) * vis;
          #ifdef ABSORB
            gl_FragColor = vec4(1.0 - dens * vec3(0.12, 0.72, 0.68), 1.0);
          #else
            gl_FragColor = vec4(min(col * 0.8, vec3(3.0)), 1.0);
          #endif
        }`,
    });
    // もやは 2 回に分けて描く: 先に後ろの景色から緑と青を吸い（赤いガラス越しのように）、次に赤い光を足す。
    // ふつうの半透明で赤を重ねると、日なたの草の上では橙色に濁るため
    const pair = (mat) => {
      const absorb = mat.clone();
      absorb.defines = { ABSORB: 1 };
      Object.assign(absorb, { blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      Object.assign(mat, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      absorb.uniforms = this.uniforms;
      return [absorb, mat];
    };
    const [fa, fe] = pair(this.floorMat), [wa, we] = pair(this.wallMat);
    const fg0 = new THREE.BufferGeometry(), wg0 = new THREE.BufferGeometry();
    this.floorA = new THREE.Mesh(fg0, fa); this.floor = new THREE.Mesh(fg0, fe);
    this.wallA = new THREE.Mesh(wg0, wa); this.wall = new THREE.Mesh(wg0, we);
    this.floorA.renderOrder = this.wallA.renderOrder = 4;
    this.sparks = new THREE.Points(new THREE.BufferGeometry(), this.sparkMat);
    for (const o of [this.floorA, this.wallA, this.floor, this.wall, this.sparks]) { o.frustumCulled = false; o.renderOrder ||= 5; o.userData.noAO = true; this.group.add(o); }

    this.glow = document.getElementById('fence-glow');
    this.tip = document.getElementById('fence-tip');
    this.tipT = 0;
  }

  get zones() { return this.extra ? [...this.pins, this.extra] : this.pins; }
  get limited() { return !this.free && this.pins.length > 0; }

  // 歩ける範囲を決める: 円 { x, z, r } か、長方形 { x, z, ux, uz, hw, hd }（(ux, uz) = 幅 hw の向き、奥行き hd はその直角）
  setZones(list) { this.pins = list; this.build(); }
  // (x, z) のまわりも歩けるようにする（null で取り消し）
  setExtra(x, z) {
    const e = x == null ? null : { x, z, r: FENCE_R };
    if (!e && !this.extra) return;
    this.extra = e; this.build();
  }
  // 範囲の内側か（extra: 追加の輪も含める）
  inside(x, z, extra = true) {
    for (const c of extra ? this.zones : this.pins) if (sdf(c, x, z) <= 0) return true;
    return false;
  }

  // はみ出した点を、いちばん近い範囲のふちへ戻す（中なら null）
  clamp(x, z) {
    if (!this.limited) return null;
    let best = null, bd = Infinity;
    for (const c of this.zones) {
      const d = sdf(c, x, z);
      if (d <= 0) return null;
      if (d < bd) { bd = d; best = nearest(c, x, z); }
    }
    return best;
  }

  // 境目の幕と火の粉を作り直す（ほかの輪の内側に入る部分は描かない）
  build() {
    const zones = this.zones;
    const pos = [], h = [], vis = [], nrm = [], idx = [];
    const sp = [], sn = [], seed = [];
    const fp = [], fin = [], fvis = [], fidx = [];
    const RING = [0, 0.25, 0.6, 1.1, 1.8, 2.8, 4.5, 7]; // 地面の輪の、境目から内側への刻み（外の 2 段は空から見る用）
    let rnd = 91;
    const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    for (const c of zones) {
      // ふちの線（円は 1 本の輪、長方形は 4 辺）。点ごとに外向きの向きと、内側へ入れる深さの上限
      for (const path of outline(c)) {
        const base = pos.length / 3;
        path.forEach(({ x, z, nx, nz, cap }, k) => {
          let v = 1;
          for (const o of zones) if (o !== c) v = Math.min(v, THREE.MathUtils.smoothstep(sdf(o, x, z), -1.2, 0.3));
          // 下は地形（海なら少し沈める）、上は橋・岸壁の上面から
          const y0 = Math.max(this.ground(x, z), -0.6) - 0.15, y1 = this.groundAt(x, z) + WALL_H;
          pos.push(x, y0, z, x, y1, z);
          h.push(-0.15, y1 - y0 - 0.15); // 地面からの高さ
          vis.push(v, v); nrm.push(nx, nz, nx, nz);
          if (k < path.length - 1) {
            const i = base + k * 2;
            idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
          }
          // 地面の輪: 長方形の角では 2 辺の帯が重ならないよう、角の二等分線で止める（cap）
          const fb = fp.length / 3;
          for (const d0 of RING) {
            const d = Math.min(d0, cap);
            const rx = x - nx * d, rz = z - nz * d;
            fp.push(rx, this.groundAt(rx, rz) + 0.04, rz); fin.push(d); fvis.push(v);
          }
          if (k < path.length - 1) {
            const m = RING.length;
            for (let j = 0; j < m - 1; j++) { const i = fb + j, q = fb + m + j; fidx.push(i, q, i + 1, i + 1, q, q + 1); }
          }
        });
        // 火の粉: 1m に 1.6 個ほど、見える所だけ
        const len = path.reduce((a, p, k) => a + (k ? Math.hypot(p.x - path[k - 1].x, p.z - path[k - 1].z) : 0), 0);
        const m = Math.round(len * 1.6);
        for (let k = 0; k < m; k++) {
          const f = rand() * (path.length - 1), i = Math.floor(f), a = f - i, P = path[i], Q = path[i + 1];
          const x = P.x + (Q.x - P.x) * a, z = P.z + (Q.z - P.z) * a;
          if (zones.some((o) => o !== c && sdf(o, x, z) < -0.3)) continue;
          sp.push(x, this.groundAt(x, z) + 0.05, z); sn.push(P.nx, P.nz);
          seed.push(rand(), rand(), rand() ** 2, rand());
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
    g.setAttribute('aVis', new THREE.Float32BufferAttribute(vis, 1));
    g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 2));
    g.setIndex(idx);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    fg.setAttribute('aIn', new THREE.Float32BufferAttribute(fin, 1));
    fg.setAttribute('aVis', new THREE.Float32BufferAttribute(fvis, 1));
    fg.setIndex(fidx);
    this.floor.geometry.dispose();
    this.floor.geometry = this.floorA.geometry = fg;
    this.wall.geometry.dispose();
    this.wall.geometry = this.wallA.geometry = g;
    const s = new THREE.BufferGeometry();
    s.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    s.setAttribute('aN', new THREE.Float32BufferAttribute(sn, 2));
    s.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
    this.sparks.geometry.dispose();
    this.sparks.geometry = s;
    this.onChange?.();
  }

  // 毎フレーム。player.fenceHit: 押し当てた点、sky: 空から見ている具合（0..1）
  update(dt, { time, player, camera, sky = 0, walking = true }) {
    const u = this.uniforms;
    this.alpha += ((this.limited ? 1 : 0) - this.alpha) * (1 - Math.exp(-dt * 3));
    this.group.visible = this.alpha > 0.003;
    u.uTime.value = time;
    u.uAlpha.value = this.alpha;
    u.uSky.value = sky;
    u.uPlayer.value.copy(player.pos);
    u.uPx.value = (camera.projectionMatrix.elements[5] * innerHeight) / 2;
    // 押し当て: 当たった所を追いかけ、離れるとすっと引く
    const hit = walking && this.limited && player.fenceHit && player.fenceHitT < 0.12;
    if (hit) {
      if (this.push < 0.05) this.pushPos.copy(player.fenceHit);
      else this.pushPos.lerp(player.fenceHit, 1 - Math.exp(-dt * 10));
    }
    this.push += ((hit ? 1 : 0) - this.push) * (1 - Math.exp(-dt * (hit ? 6 : 2.5)));
    u.uPush.value = this.push;
    // 画面のふちの赤みと、ひとこと
    if (this.glow) this.glow.style.opacity = (this.push * 0.6).toFixed(3);
    if (hit) this.tipT = 2.2; else this.tipT = Math.max(0, this.tipT - dt);
    this.tip?.classList.toggle('show', this.tipT > 0 && walking);
  }
}
