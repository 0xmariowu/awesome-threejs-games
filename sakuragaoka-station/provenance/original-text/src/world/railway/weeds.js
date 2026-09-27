// Corridor weeds: grass tufts, tall grass, dandelions (flowers + clocks), 菜の花, ヒメジョオン daisies,
// ホトケノザ / オオイヌノフグリ, つくし & スギナ. One instanced crossed-card mesh with an atlas cell per
// instance and a wind-sway vertex patch (shares ctx.shared uTime / uWind / uGust). noOutline.
import * as THREE from 'three';

// atlas cells: 0 tuft, 1 tall grass, 2 dandelion, 3 clocks, 4 菜の花, 5 daisy, 6 henbit, 7 horsetail
const SIZE = [[0.42, 0.3], [0.8, 0.8], [0.34, 0.24], [0.32, 0.32], [0.72, 0.85], [0.48, 0.5], [0.34, 0.2], [0.42, 0.4]];

function weedMaterial(ctx, map) {
  const m = ctx.mat.foliage('#ffffff', map, { name: 'rw-weeds', paint: 0.04, alphaTest: 0.42 });
  if (m.userData.rwSway) return m;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.uniforms.uTime = ctx.shared.uTime;
    shader.uniforms.uWind = ctx.shared.uWind;
    shader.uniforms.uGust = ctx.shared.uGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec2 uWind; uniform float uGust;
        attribute vec4 aCell;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv = aCell.xy + uv * aCell.zw;
        #endif`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        {
          float hh = clamp(position.y, 0.0, 1.0);
          vec2 base = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float ph = dot(base, vec2(0.71, 1.13));
          float sw = sin(uTime * 1.7 + ph) * 0.62 + sin(uTime * 3.1 + ph * 1.7) * 0.38;
          float hgt = length(instanceMatrix[1].xyz);
          vec2 wd = uWind / max(length(uWind), 1e-3);
          float amp = (0.05 + 0.07 * uGust) * hgt;
          mvPosition.xz += wd * (0.35 + 0.65 * sw) * amp * hh * hh;
          mvPosition.y -= 0.12 * amp * hh * hh * abs(sw);
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    // keep both card faces lit the same way (no back-face normal flip)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );');
  };
  m.customProgramCacheKey = () => 'paint|rw-weeds-sway';
  m.userData.rwSway = true;
  return m;
}

function crossCard() {
  const pos = [], nor = [], uv = [], idx = [];
  for (let q = 0; q < 2; q++) {
    const a = q * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = -Math.sin(a) * 0.5;
    const fn = [Math.sin(a), 0, Math.cos(a)];
    const base = pos.length / 3;
    for (const [s, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      pos.push(cx * s, y, cz * s);
      const n = new THREE.Vector3(fn[0] * 0.3, 1, fn[2] * 0.3).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(s < 0 ? 0 : 1, y);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function buildWeeds(ctx, root, T, E, track, cat, side) {
  const { L } = ctx;
  const r = ctx.rng('rw-weeds');
  const items = [];
  const pickW = (list) => { let s = 0; for (const it of list) s += it[1]; let v = r() * s; for (const it of list) { v -= it[1]; if (v <= 0) return it[0]; } return list[0][0]; };
  const add = (x, y, z, cell, scale = 1) => {
    const [w, h] = SIZE[cell];
    const k = scale * (0.75 + r() * 0.5);
    items.push({ x, y: y - 0.015, z, ry: r() * Math.PI, sx: w * k * (0.85 + r() * 0.3), sy: h * k, sz: w * k * (0.85 + r() * 0.3), cell });
  };
  const inCross = (x, m = 0.2) => x > E.cross[0] - m && x < E.cross[1] + m;
  const inWalk = (x, m = 0.2) => x > E.walk[0] - m && x < E.walk[1] + m;
  const inStation = (x) => x > -7.3 && x < 50.3;
  const gy = (x, z) => L.heightAt(x, z);
  const zs = side.zs, S = side.S;

  const MIX_FENCE = [[1, 30], [0, 26], [7, 10], [5, 12], [2, 8], [3, 4], [6, 6], [4, 4]];
  const MIX_EDGE = [[0, 40], [2, 16], [6, 16], [7, 10], [5, 8], [3, 8]];
  const MIX_BED = [[0, 55], [6, 22], [2, 14], [3, 9]];
  // 菜の花 patches along the corridor edges
  const NANOHANA = [[-82, -64], [-44, -36], [58, 70], [96, 112], [-150, -128], [140, 160], [-240, -205], [205, 250], [-330, -300], [300, 340]];
  const inNano = (x) => NANOHANA.some(([a, b]) => x > a && x < b);

  for (const sgn of [1, -1]) {
    const zF = zs(S.fence, sgn);
    for (const [a, b] of side.STRIP_X) {
      for (let x = a + 0.3; x < b; x += 0.34) {
        const near = Math.abs(x) < 175;
        if (!near && r() > 0.3) continue;
        // fence band (corridor side of the fence + right at its base)
        const nFence = near ? 2 : 1;
        for (let i = 0; i < nFence; i++) {
          const z = zF - sgn * (0.08 + Math.pow(r(), 1.6) * 1.05);
          const cell = inNano(x) && r() < 0.42 ? 4 : pickW(MIX_FENCE);
          add(x + (r() - 0.5) * 0.3, gy(x, z), z, cell, near ? 1 : 1.25);
        }
        if (!near) continue;
        // drainage channel edges
        if (side.inRanges(x, side.DETAIL_X) && r() < 0.28) { const z = zs(S.drain, sgn) - sgn * (0.28 + r() * 0.15); add(x, gy(x, z), z, pickW(MIX_EDGE), 0.8); }
        // gravel strip (sparse)
        if (r() < 0.1) { const z = zs(-38.2 + r() * 3.0, sgn); add(x, gy(x, z), z, pickW(MIX_EDGE), 0.7); }
        // trough / walkway edges
        if (side.inRanges(x, side.DETAIL_X) && r() < 0.12) { const z = zs(S.trough, sgn) + sgn * (0.22 + r() * 0.1); add(x, gy(x, z), z, pickW(MIX_EDGE), 0.65); }
      }
    }
  }
  // ballast shoulders & toe (not under the platforms, not in the crossing / walkway)
  for (let x = -250; x < 260; x += 0.5) {
    if (inCross(x) || inWalk(x) || (x > -7.3 && x < 46.3)) continue;
    const near = Math.abs(x) < 175;
    for (const sgn of [1, -1]) {
      if (r() > (near ? 0.62 : 0.2)) continue;
      const d = 3.35 + r() * 0.62, z = -43 + sgn * d;
      add(x + (r() - 0.5) * 0.4, E.ballastY(z), z, pickW(MIX_EDGE), 0.72);
    }
  }
  // between the tracks (also inside the station, sparse) and a few in the cribs
  for (let x = -200; x < 220; x += 0.5) {
    if (inCross(x) || inWalk(x)) continue;
    const near = Math.abs(x) < 150;
    const pBetween = inStation(x) ? 0.14 : near ? 0.3 : 0.08;
    if (r() < pBetween) {
      const z = -43 + (r() - 0.5) * 1.8;
      if (!track.onSleeper(x, z) && !track.nearRail(x, z, 0.12) && !(x > track.TX0 && x < track.TX1 && Math.abs(z - E.xo.zc(x)) < 1.2)) add(x, E.ballastY(z), z, pickW(MIX_BED), 0.6);
    }
    if (near && r() < 0.05) {
      const zT = r() < 0.5 ? E.zA : E.zB, z = zT + (r() - 0.5) * 1.9;
      if (!track.onSleeper(x, z, 0.05) && !track.nearRail(x, z, 0.14)) add(x, E.ballastY(z), z, r() < 0.7 ? 0 : 6, 0.45);
    }
  }
  // around pole foundations
  for (const p of cat.poles) {
    if (Math.abs(p.x) > 200 || inCross(p.x, 1) || inWalk(p.x, 1)) continue;
    const spots = p.type === 'C' ? [[p.x, -43]] : [[p.x, cat.zSouthPole], [p.x, cat.zNorthPole]];
    for (const [px, pz] of spots) {
      for (let i = 0; i < 5; i++) {
        const a = r() * 6.28, d = 0.36 + r() * 0.25, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d * (p.type === 'C' ? 0.5 : 1);
        const y = p.type === 'C' ? E.ballastY(z) : gy(x, z);
        add(x, y, z, p.type === 'C' ? pickW(MIX_BED) : pickW(MIX_EDGE), 0.75);
      }
    }
  }

  // build the instanced mesh
  const geo = crossCard();
  const n = items.length;
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  items.forEach((it, i) => { const c = it.cell % 4, row = Math.floor(it.cell / 4); cellAttr.setXYZW(i, c * 0.25 + 0.004, 1 - (row + 1) * 0.5 + 0.004, 0.25 - 0.008, 0.5 - 0.008); });
  geo.setAttribute('aCell', cellAttr);
  const m = new THREE.InstancedMesh(geo, weedMaterial(ctx, T.weeds), n);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  items.forEach((it, i) => { _e.set(0, it.ry, 0); _q.setFromEuler(_e); _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx, it.sy, it.sz)); m.setMatrixAt(i, _m); });
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.castShadow = false; m.receiveShadow = true;
  m.name = 'rw-weeds';
  m.frustumCulled = true;
  ctx.noOutline(m);
  root.add(m);
  return { count: n };
}
