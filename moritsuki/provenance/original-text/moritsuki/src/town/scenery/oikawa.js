// 定食屋の前の用水路を泳ぐオイカワ（2026-09-25 ユーザー依頼「定食屋の前にオイカワを数匹泳がせて」）
// 夏なので雄は婚姻色（青緑の地に桃色の横帯、赤い腹びれ・長い尻びれ、黒い頭）、雌と若魚は銀色。
// 流れ（+t 向き）に頭を向けて止まり、ときどき群れごと場所を変える。底の藻をつつくとき体を倒して銀色に光る。
// 主人公が近づくと上流か下流へ走って逃げる（そっと寄れば眺められる。走ってくると遠くから逃げる）。
// 形は 1 m の魚をローカル座標（x = 前、y = 上、z = 横）で作り、インスタンスの行列で体長に縮める。
// 尾を振る動き・曲がるときの体のしなりは頂点シェーダ（インスタンスごとの aSwim = 位相・振れ幅・しなり・模様のずれ）
import * as THREE from 'three';

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// ---------- 形 ----------
// 胴: s = 0（吻端）→ 1（尾の先）。胴は s ≤ 0.8、その先は尾びれ。x = 0.5 - s
const BODY_END = 0.8;
function height(s) {
  const u = s / BODY_END;
  const rise = Math.pow(Math.sin(Math.min(1, u / 0.36) * Math.PI / 2), 0.75);
  return 0.235 * rise * (1 - 0.64 * smooth(0.38, 1, u)) + 0.004;
}
const widthOf = (s) => height(s) * lerp(0.5, 0.36, smooth(0.1, 0.5, s / BODY_END));

function fishGeometry(male) {
  const pos = [], info = [], idx = [];
  const v = (x, y, z, s, vv, part) => { pos.push(x, y, z); info.push(s, vv, part); return pos.length / 3 - 1; };
  const tri = (a, b, c) => idx.push(a, b, c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  // 胴の輪
  const NS = 26, NR = 16;
  const top = (s) => { const h = height(s); return [h * 0.56 - 0.012 * (1 - smooth(0, 0.18, s)), -h * 0.44 - 0.012 * (1 - smooth(0, 0.18, s))]; };
  const rings = [];
  for (let i = 0; i <= NS; i++) {
    const s = BODY_END * Math.pow(i / NS, 1.15) + 0.004;
    const [yt, yb] = top(s), hw = widthOf(s) / 2, row = [];
    for (let j = 0; j < NR; j++) {
      const th = (j / NR) * TAU, sn = Math.sin(th), cs = Math.cos(th);
      // 背と腹は少し角ばる（側扁した体）
      const y = sn > 0 ? sn * yt : -sn * yb;
      const z = cs * hw * (1 - 0.18 * sn * sn);
      row.push(v(0.5 - s, y, z, s, sn, 0));
    }
    rings.push(row);
  }
  const nose = v(0.5, -0.012, 0, 0, 0, 0);
  for (let j = 0; j < NR; j++) tri(nose, rings[0][(j + 1) % NR], rings[0][j]);
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
    const j2 = (j + 1) % NR;
    quad(rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]);
  }
  const tailC = v(0.5 - BODY_END - 0.004, 0, 0, BODY_END, 0, 0);
  for (let j = 0; j < NR; j++) tri(tailC, rings[NS][j], rings[NS][(j + 1) % NR]);

  // ひれ（両面の薄い板）。part: 1 背びれ 2 尻びれ 3 尾びれ 4 腹びれ 5 胸びれ
  const X = (s) => 0.5 - s;
  const fin = (pts, part) => {
    const ids = pts.map(([s, y, z, t]) => v(X(s), y, z, s, t, part));
    for (let k = 1; k + 1 < ids.length; k++) tri(ids[0], ids[k], ids[k + 1]);
  };
  // 背びれ: 胴のまん中より少し後ろ、前が高い
  {
    const a = 0.43, b = 0.56;
    fin([[a, top(a)[0] - 0.004, 0, 0], [a + 0.03, top(a + 0.03)[0] + (male ? 0.13 : 0.11), 0, 1], [b + (male ? 0.03 : 0.01), top(b)[0] + 0.035, 0, 1], [b, top(b)[0] - 0.004, 0, 0]], 1);
  }
  // 尻びれ: 雄は大きく、うしろの軟条が尾の近くまでのびる
  {
    const a = male ? 0.56 : 0.59, b = male ? 0.74 : 0.69, d = male ? 0.12 : 0.075;
    fin([[a, top(a)[1] + 0.004, 0, 0], [a + 0.03, top(a)[1] - d, 0, 1], [b + (male ? 0.1 : 0.03), top(b)[1] - d * (male ? 0.62 : 0.4), 0, 1], [b, top(b)[1] + 0.004, 0, 0]], 2);
  }
  // 尾びれ: 深く切れこむ
  {
    const s0 = BODY_END - 0.03, h0 = height(s0) * 0.45;
    fin([[s0, 0, 0, 0], [s0, h0, 0, 0], [0.87, 0.08, 0, 0.5], [1.0, 0.125, 0, 1], [0.955, 0.055, 0, 0.85], [0.905, 0, 0, 0.7], [0.955, -0.055, 0, 0.85], [1.0, -0.125, 0, 1], [0.87, -0.08, 0, 0.5], [s0, -h0, 0, 0]], 3);
  }
  // 腹びれ・胸びれ（左右。少し外へ開く）
  for (const side of [-1, 1]) {
    const pa = 0.44, pb = top(pa)[1];
    fin([[pa, pb + 0.01, side * 0.012, 0], [pa + 0.1, pb - (male ? 0.045 : 0.035), side * 0.035, 1], [pa + 0.07, pb - 0.005, side * 0.02, 1]], 4);
    const qa = 0.2, qb = top(qa)[1] * 0.6;
    fin([[qa, qb, side * widthOf(qa) * 0.45, 0], [qa + 0.13, qb - 0.04, side * (widthOf(qa) * 0.5 + 0.05), 1], [qa + 0.1, qb - 0.005, side * (widthOf(qa) * 0.5 + 0.035), 1]], 5);
  }
  // 目: 体の面より少し外に円盤（part 6、t = 中心からの距離）
  for (const side of [-1, 1]) {
    const s = 0.085, y = 0.012, r = 0.024, z = side * (widthOf(s) / 2 * 0.92 + 0.004);
    const c = v(X(s), y, z, s, 0, 6), ring = [];
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; ring.push(v(X(s) + Math.cos(a) * r, y + Math.sin(a) * r, z, s, 1, 6)); }
    for (let k = 0; k < 10; k++) side > 0 ? tri(c, ring[k], ring[(k + 1) % 10]) : tri(c, ring[(k + 1) % 10], ring[k]);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function fishMaterial(male) {
  // ひれは透ける（alphaHash: 不透明の描画のまま点描で抜く）
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1, alphaHash: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aInfo;\nattribute vec4 aSwim;\nvarying vec3 vInfo;\nvarying float vSeed;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        // 尾を振る波（頭はほとんど動かず、うしろほど大きい）と、曲がるときのしなり
        float sS = aInfo.x;
        float ampS = aSwim.y * (0.012 + 0.11 * sS * sS);
        float kW = 6.2831 * 0.95;
        float wv = sin(kW * sS - aSwim.x);
        float bend = aSwim.z * (sS - 0.22) * (sS - 0.22);
        float dzds = ampS * kW * cos(kW * sS - aSwim.x) + aSwim.y * 0.22 * sS * wv + aSwim.z * 2.0 * (sS - 0.22);
        objectNormal.x += dzds * objectNormal.z;
        objectNormal = normalize(objectNormal);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.z += ampS * wv + bend;
        vInfo = aInfo; vSeed = aSwim.w;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInfo;\nvarying float vSeed;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float s = vInfo.x, vv = vInfo.y, part = vInfo.z;
        float metal = 0.0, rough = 0.5;
        vec3 col;
        if (part < 0.5) {
          // 胴: 背（暗い）→ わき（銀）→ 腹（白）
          float back = smoothstep(0.15, 0.75, vv), belly = smoothstep(-0.35, -0.85, vv);
          ${male ? `
          // 雄の婚姻色: 青緑の地に、前へ少し傾いた桃色の横帯。頭は黒く、ほおに追星（白い点）
          vec3 side = vec3(0.16, 0.42, 0.40);
          float bar = smoothstep(0.25, 0.6, abs(fract((s + vv * 0.035) * 17.0 + vSeed) - 0.5) * 2.0);
          bar *= smoothstep(0.2, 0.3, s) * smoothstep(0.8, 0.7, s) * smoothstep(0.75, 0.2, vv) * smoothstep(-0.8, -0.3, vv);
          side = mix(side, vec3(0.86, 0.46, 0.44), bar);
          col = mix(side, vec3(0.08, 0.17, 0.18), back);
          col = mix(col, vec3(0.86, 0.62, 0.55), belly);
          float head = smoothstep(0.2, 0.13, s) * smoothstep(-0.9, -0.3, vv);
          col = mix(col, vec3(0.05, 0.06, 0.08), head * 0.85);
          float dots = step(0.82, fract(sin(dot(floor(vec2(s * 90.0, vv * 9.0)), vec2(12.9898, 78.233))) * 43758.5453));
          col = mix(col, vec3(0.85), dots * head * step(-0.5, vv) * step(vv, 0.4));
          metal = mix(0.55, 0.2, head) * (1.0 - back * 0.5); rough = mix(0.28, 0.45, bar);` : `
          // 雌・若魚: 銀色。うすい青灰色の横帯が見える
          vec3 side = vec3(0.78, 0.81, 0.80);
          float bar = smoothstep(0.35, 0.7, abs(fract((s + vv * 0.03) * 16.0 + vSeed) - 0.5) * 2.0);
          bar *= smoothstep(0.22, 0.32, s) * smoothstep(0.8, 0.7, s) * smoothstep(0.6, 0.0, vv) * smoothstep(-0.7, -0.2, vv);
          side = mix(side, vec3(0.52, 0.6, 0.66), bar * 0.45);
          col = mix(side, vec3(0.34, 0.39, 0.35), back);
          col = mix(col, vec3(0.9, 0.9, 0.87), belly);
          metal = 0.75 * (1.0 - back * 0.6) * (1.0 - belly * 0.4); rough = 0.22 + back * 0.3;`}
          // 側線
          col *= 1.0 - 0.18 * smoothstep(0.03, 0.0, abs(vv + 0.05 - s * 0.1)) * step(0.2, s);
        } else if (part > 5.5) {
          // 目: 黒い瞳と銀色のふち
          col = mix(vec3(0.02), vec3(0.75, 0.72, 0.6), smoothstep(0.55, 0.75, vv));
          metal = 0.3; rough = 0.15;
        } else {
          // ひれ: 付け根は体の色、先は薄い
          ${male ? `
          vec3 fc = part < 1.5 ? vec3(0.28, 0.4, 0.3) : part < 2.5 || (part > 3.5 && part < 4.5) ? vec3(0.9, 0.34, 0.2) : part < 3.5 ? vec3(0.35, 0.42, 0.38) : vec3(0.6, 0.45, 0.35);
          if (part < 2.5 && part > 1.5) fc = mix(fc, vec3(0.95, 0.85, 0.75), smoothstep(0.75, 1.0, vv));` : `
          vec3 fc = part > 3.5 && part < 4.5 || (part > 1.5 && part < 2.5) ? vec3(0.8, 0.72, 0.6) : vec3(0.62, 0.66, 0.6);`}
          col = mix(fc * 0.85, fc, vv);
          metal = 0.05; rough = 0.55;
          diffuseColor.a = mix(0.95, ${male ? '0.55' : '0.3'}, vv);
        }
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = metal;');
  };
  m.customProgramCacheKey = () => 'oikawa-' + (male ? 'm' : 'f');
  return m;
}

// 底に落ちる影（日の当たる所だけ。細長いぼかし）
function shadowMesh(n) {
  const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const op = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  op.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aOp', op);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aOp;\nvarying float vOp;\nvarying vec2 vQ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOp = aOp; vQ = position.xz * 2.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vOp;\nvarying vec2 vQ;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // 頭の方（+x）が太い
        vec2 q = vQ; q.y *= mix(1.25, 0.8, q.x * 0.5 + 0.5);
        diffuseColor.a = vOp * (1.0 - smoothstep(0.35, 1.0, length(q)));`);
  };
  m.customProgramCacheKey = () => 'oikawa-shadow';
  const im = new THREE.InstancedMesh(g, m, n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  im.renderOrder = -1; // 水面（透ける材質）より先に描く（水面が深度を書くので、あとだと隠れる）
  im.name = 'oikawa-shadows';
  return im;
}

// ---------- 泳ぎ ----------
// lane: { t0, t1, w0, w1, floor(t), surface(t), wall: [w, w] 水路の内のかべ, top 底からかべの上まで, world(t, w) → [x, z], tw(x, z) → [t, w], TDIR, WDIR, sun }
// 流れは +t の向き
export function buildOikawa(lane, { count = [4, 2], seed = 31 } = {}) {
  let sd = seed;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const group = new THREE.Group();
  group.name = 'oikawa';
  const CUR = 0.16; // 流れ（m/s）
  const VIS = 1.4;  // 水ごしの小さな魚が見えるように実物より大きく描く（銛一本の FISH_VIS と同じ考え）
  const fish = [];
  const meshes = [];
  for (const male of [false, true]) {
    const n = count[male ? 1 : 0];
    const geo = fishGeometry(male);
    const swim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    swim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSwim', swim);
    const im = new THREE.InstancedMesh(geo, fishMaterial(male), n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = false; // 小さすぎて影の地図に写らない。底の影は shadowMesh で描く
    im.frustumCulled = false; // 位置は毎フレーム変わる（遠いときは group ごと隠す）
    im.name = male ? 'oikawa-male' : 'oikawa-female';
    group.add(im);
    meshes.push(im);
    for (let i = 0; i < n; i++) {
      const t = lerp(lane.t0 + 3, lane.t1 - 3, 0.35 + rnd() * 0.3);
      fish.push({
        im, i, swim, male,
        L: (male ? 0.15 + rnd() * 0.02 : 0.12 + rnd() * 0.025) * VIS,
        t, w: lerp(lane.w0, lane.w1, rnd()), h: 0.4 + rnd() * 0.3, // h: 底（0）〜水面（1）
        vt: 0, vw: 0, a: Math.PI, turn: 0, roll: 0, pitch: 0,
        phase: rnd() * TAU, amp: 0.4, tgt: [t, 0, 0.5], off: [(rnd() - 0.5) * 1.4, rnd()], timer: rnd() * 2, vmax: 0.3,
        peck: 0, seed: rnd(),
      });
    }
  }
  const school = { t: fish[0].t, timer: 6, flee: 0 };
  const shadows = shadowMesh(fish.length);
  group.add(shadows);
  const sun = lane.sun, st = sun.dot(lane.TDIR), sw = sun.dot(lane.WDIR);

  const _m = new THREE.Matrix4(), _f = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let last = null;
  const mid = lane.world((lane.t0 + lane.t1) / 2, (lane.w0 + lane.w1) / 2);
  const reach = (lane.t1 - lane.t0) / 2 + 45;

  const retarget = (f, far) => {
    const { t0, t1, w0, w1 } = lane;
    f.tgt[0] = Math.max(t0, Math.min(t1, school.t + f.off[0] + (rnd() - 0.5) * 0.6 + (far ? (rnd() < 0.5 ? -1 : 1) * (1.5 + rnd() * 2) : 0)));
    f.tgt[1] = lerp(w0, w1, rnd());
    f.tgt[2] = 0.3 + rnd() * 0.5;
    f.vmax = far ? 0.9 + rnd() * 0.4 : 0.25 + rnd() * 0.15;
    f.timer = 1.5 + rnd() * 3;
    // 底の藻をつつく（体を倒して光る）
    if (!far && rnd() < 0.18) { f.tgt[2] = 0.08; f.peck = 1.2 + rnd() * 0.8; }
  };

  const update = (time, camera, player) => {
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, time - last));
    last = time;
    const cp = camera.position;
    group.visible = Math.hypot(cp.x - mid[0], cp.z - mid[1]) < reach;
    if (!group.visible || dt === 0) return;
    const { t0, t1, w0, w1 } = lane;

    // 群れの中心: ときどき場所を変える。主人公が水路に近づいたら逃げる
    school.timer -= dt;
    school.flee = Math.max(0, school.flee - dt);
    if (player) {
      const [pt, pw] = lane.tw(player.pos.x, player.pos.z);
      const near = Math.abs(pw - (w0 + w1) / 2) < 3.2;
      const scare = 1.6 + Math.min(6, player.speed || 0) * 0.32;
      for (const f of fish) {
        const d = Math.hypot(f.t - pt, (f.w - pw) * 1.3);
        if (!near || d > scare || f.flee > 0) continue;
        // 遠い方へ。行き止まりが近ければ主人公の足もとをくぐって反対へ
        let dir = Math.sign(f.t - pt) || 1;
        if ((dir > 0 ? t1 - f.t : f.t - t0) < 2.5) dir = -dir;
        const to = Math.max(t0, Math.min(t1, pt + dir * (4 + rnd() * 3)));
        school.t = to; school.timer = 5 + rnd() * 4; school.flee = 1.5;
        for (const g of fish) {
          if (g.flee > 0) continue;
          const lag = Math.abs(g.t - pt) < 4 ? 0 : 0.1 + rnd() * 0.3; // 近い魚から順に走る
          g.flee = 1.2 + rnd() * 0.6 + lag; g.fleeLag = lag;
          g.tgt[0] = Math.max(t0, Math.min(t1, to + (rnd() - 0.5) * 1.6)); g.tgt[1] = lerp(w0, w1, rnd()); g.tgt[2] = 0.3 + rnd() * 0.4;
          g.vmax = 1.3 + rnd() * 0.5; g.timer = 2.5 + rnd() * 2; g.peck = 0;
        }
        break;
      }
    }
    if (school.timer < 0) {
      school.timer = 5 + rnd() * 7;
      school.t = Math.max(t0 + 1, Math.min(t1 - 1, school.t + (rnd() - 0.5) * 5));
      for (const f of fish) f.timer = Math.min(f.timer, rnd() * 1.2);
    }

    for (const f of fish) {
      f.timer -= dt;
      if (f.flee > 0) { f.flee -= dt; f.fleeLag = Math.max(0, (f.fleeLag || 0) - dt); }
      else if (f.timer < 0) retarget(f, rnd() < 0.12);
      f.peck = Math.max(0, f.peck - dt);
      // 目標へ向かう速さ（近づくと止まる）+ となりの魚から離れる
      const dT = f.tgt[0] - f.t, dW = f.tgt[1] - f.w, dist = Math.hypot(dT, dW);
      const lagging = f.flee > 0 && f.fleeLag > 0;
      const want = lagging ? 0 : Math.min(f.vmax, dist * 1.4);
      let ut = dist > 1e-4 ? (dT / dist) * want : 0, uw = dist > 1e-4 ? (dW / dist) * want : 0;
      for (const g of fish) {
        if (g === f) continue;
        const et = f.t - g.t, ew = f.w - g.w, e = Math.hypot(et, ew);
        if (e < 0.24 && e > 1e-4) { const k = (0.24 - e) * 2.5; ut += (et / e) * k; uw += (ew / e) * k; }
      }
      // 壁から離れる
      const m = 0.1;
      if (f.w < w0 + m) uw += (w0 + m - f.w) * 6;
      if (f.w > w1 - m) uw -= (f.w - (w1 - m)) * 6;
      const acc = f.flee > 0 ? 7 : 1.6, k = 1 - Math.exp(-acc * dt);
      f.vt += (ut - f.vt) * k; f.vw += (uw - f.vw) * k;
      f.t = Math.max(t0, Math.min(t1, f.t + f.vt * dt));
      f.w = Math.max(w0, Math.min(w1, f.w + f.vw * dt));
      if ((f.t === t0 && f.vt < 0) || (f.t === t1 && f.vt > 0)) f.vt = 0;
      const dh = (f.tgt[2] - f.h) * (1 - Math.exp(-1.5 * dt));
      f.h += dh;

      // 向き: 水に対して進む向き（止まっていれば流れに頭を向ける）
      const rt = f.vt - CUR, rw = f.vw, rs = Math.hypot(rt, rw);
      const aim = Math.atan2(rw, rt) + Math.sin(time * 1.3 + f.seed * 20) * 0.08 * (1 - Math.min(1, rs));
      let da = aim - f.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const rate = (f.flee > 0 ? 14 : 4) * Math.min(1, Math.abs(da) * 3 + 0.2);
      const step = Math.sign(da) * Math.min(Math.abs(da), rate * dt);
      f.a += step;
      const omega = step / Math.max(dt, 1e-4);
      f.turn += (Math.max(-2.2, Math.min(2.2, -omega * 0.16)) - f.turn) * (1 - Math.exp(-10 * dt));
      // 尾: 水に対する速さで振る速さと振れ幅が決まる
      const effort = Math.min(1, rs / 1.1 + Math.abs(omega) * 0.06);
      const freq = 2.2 + effort * 11;
      f.phase = (f.phase + TAU * freq * dt) % (TAU * 1000);
      f.amp += (0.3 + effort * 0.9 - f.amp) * (1 - Math.exp(-6 * dt));
      // 底をつつくとき体を倒す（銀色が光る）。曲がるときも少し傾ける
      const peckRoll = f.peck > 0 && f.h < 0.2 ? Math.sin(Math.min(1, f.peck) * Math.PI) * 1.1 * (f.seed < 0.5 ? 1 : -1) : 0;
      f.roll += (peckRoll + omega * 0.05 - f.roll) * (1 - Math.exp(-8 * dt));
      f.pitch += (Math.max(-0.4, Math.min(0.4, dh / Math.max(dt, 1e-4) * 1.5)) - (f.peck > 0 && f.h < 0.2 ? 0.35 : 0) - f.pitch) * (1 - Math.exp(-5 * dt));

      // 行列（x = 前、y = 上、z = x × y）
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      _f.copy(lane.TDIR).multiplyScalar(ca).addScaledVector(lane.WDIR, sa);
      _f.y = -Math.sin(f.pitch); _f.normalize();
      _z.crossVectors(_f, UP).normalize();
      _y.crossVectors(_z, _f);
      const cr = Math.cos(f.roll), sr = Math.sin(f.roll);
      const yy = _y.clone().multiplyScalar(cr).addScaledVector(_z, sr), zz = _z.clone().multiplyScalar(cr).addScaledVector(_y, -sr);
      const [x, z] = lane.world(f.t, f.w);
      const fl = lane.floor(f.t), su = lane.surface(f.t), half = f.L * 0.13;
      const y = lerp(fl + half + 0.02, su - half - 0.02, f.h);
      _m.makeBasis(_f.multiplyScalar(f.L), yy.multiplyScalar(f.L), zz.multiplyScalar(f.L)).setPosition(x, y, z);
      f.im.setMatrixAt(f.i, _m);
      f.swim.setXYZW(f.i, f.phase, f.amp, f.turn, f.seed);

      // 底の影: 日の向きに沿って底まで下ろす。かべの陰の中なら消す
      const k2 = fish.indexOf(f), hy = y - fl;
      const sT = f.t - (st / sun.y) * hy, sW = f.w - (sw / sun.y) * hy;
      const dWall = sw > 0 ? lane.wall[1] - sW : sW - lane.wall[0];
      const lit = smooth(-0.04, 0.04, (Math.max(0, dWall) / Math.max(Math.abs(sw), 1e-3)) * sun.y - lane.top); // 日へ向かう線が、かべの所でかべより高ければ日なた
      const [sx, sz] = lane.world(sT, sW);
      _f.copy(lane.TDIR).multiplyScalar(ca).addScaledVector(lane.WDIR, sa).multiplyScalar(f.L * 1.05);
      _z.crossVectors(_f, UP).setLength(f.L * (0.3 + 0.25 * Math.abs(Math.sin(f.roll))));
      _m.makeBasis(_f, UP, _z).setPosition(sx, fl + 0.004, sz);
      shadows.setMatrixAt(k2, _m);
      shadows.geometry.attributes.aOp.setX(k2, 0.38 * lit * (1 - hy * 0.8));
    }
    for (const im of meshes) { im.instanceMatrix.needsUpdate = true; im.geometry.attributes.aSwim.needsUpdate = true; }
    shadows.instanceMatrix.needsUpdate = true; shadows.geometry.attributes.aOp.needsUpdate = true;
  };
  group.userData.update = update;
  group.userData.fish = fish;
  return group;
}
