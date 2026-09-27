// Trackside: corridor ground strips, cable troughs (トラフ), maintenance walkway, drainage channels,
// corridor fences (古レール柵 + ネットフェンス) with colliders, 立入禁止 / 緊急連絡先 signs, signals with
// red/green lamps (animated from services.rail), km posts, speed limit signs, equipment cabinets,
// reflectors, spare rails and a stack of spare sleepers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { railGeo, makeInstanced } from './track.js';

export function buildTrackside(ctx, root, T, E, track, cat) {
  const { mat, L, physics } = ctx;
  const k = ctx.kit(root);
  const r = ctx.rng('rw-side');
  const M = {
    strip: mat.toon('#ffffff', { map: T.strip, paint: 0.05, polygonOffset: -1 }),
    trough: mat.toon('#ffffff', { map: T.trough, paint: 0.05 }),
    troughSide: mat.toon('#aaa79f', { paint: 0.05 }),
    slab: mat.toon('#ffffff', { map: T.slab, paint: 0.05 }),
    conc: mat.toon('#bdbab2', { paint: 0.08 }),
    concDark: mat.toon('#8e8b84', { paint: 0.08 }),
    wet: mat.toon('#77766f', { paint: 0.08 }),
    whiteFence: mat.toon('#e7e3d9', { paint: 0.08 }),
    fencePost: mat.toon('#4e7a5c', { paint: 0.05 }),
    fenceMesh: mat.foliage('#ffffff', T.mesh, { name: 'rw-fence-mesh', alphaTest: 0.42, paint: 0.05 }),
    steel: mat.toon('#9aa1a8', { paint: 0.05 }),
    steelDark: mat.toon('#6d747c', { paint: 0.05 }),
    sigBoard: mat.toon('#36333b', { paint: 0.05 }),
    sigHood: mat.toon('#2f2c34', { side: 'double', paint: 0.05 }),
    lensG: mat.toon('#2e5a4d'), lensY: mat.toon('#6a5b30'), lensR: mat.toon('#6c3636'),
    litG: mat.emissive('#5ff0b8', 2.3), litR: mat.emissive('#ff5646', 2.3),
    box: mat.toon('#b3b8bb', { paint: 0.05 }),
    pipeDark: mat.toon('#4b4850', { paint: 0.05 }),
    white: mat.toon('#eeebe3'),
    reflR: mat.toon('#e0503f', { emissive: '#6a3418', emissiveIntensity: 0.55 }),
    reflY: mat.toon('#f0b43a', { emissive: '#6a3418', emissiveIntensity: 0.55 }),
    wood: mat.toon('#7d6552', { paint: 0.08 }),
    pc: track.M.pc,
    railSide: track.M.railSide, railTop: track.M.railTop,
    signBack: mat.toon('#9ea4aa', { paint: 0.05 }),
  };
  // soft coverage for the wire mesh when MSAA is on
  M.fenceMesh.alphaToCoverage = true;

  const gy = (x, z) => L.heightAt(x, z);
  const S = { strip: [-39.2, -34.0], trough: -38.55, walk: -36.75, equip: -35.75, drain: -34.95, fence: -33.8 };
  const zs = (v, side) => (side > 0 ? v : -86 - v); // mirror a south-strip z to the north strip
  const STRIP_X = [[-420, -17.5], [50.5, 420]];
  const DETAIL_X = [[-165, -17.5], [50.5, 172]];
  const inRanges = (x, R) => R.some(([a, b]) => x >= a && x <= b);
  const texBox = (w, h, d, m, pos, uRep = 1, vRep = 1) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
    return k.mesh(g, m, pos);
  };
  const texPlane = (texture, w, h, pos, rotY, back = M.white, depth = 0.014) => {
    const g = k.group(pos, rotY); const kk = ctx.kit(g);
    kk.box(w + 0.02, h + 0.02, depth, back, [0, 0, 0]);
    T.signMesh(kk, texture, w, h, [0, 0, depth / 2 + 0.003]);
    return g;
  };

  // ------------------------------------------------ ground strips (dirt / fine gravel / grass toward the fences)
  for (const side of [1, -1]) {
    const [zToe, zFence] = side > 0 ? S.strip : [zs(S.strip[0], -1), zs(S.strip[1], -1)];
    for (const [a, b] of STRIP_X) {
      for (let x0 = a; x0 < b - 1e-6; x0 += 40) {
        const x1 = Math.min(b, x0 + 40);
        const pos = [], uv = [], idx = [];
        for (const x of [x0, x1]) for (const z of [zToe, zFence]) { pos.push(x, gy(x, z) + 0.012, z); uv.push(x / 8, (z - zToe) / (zFence - zToe)); }
        idx.push(0, 1, 3, 0, 3, 2);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        // force an upward normal whatever the winding
        g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
        const n = new THREE.Vector3(); { const p = pos; const ax = p[3] - p[0], az = p[5] - p[2], bx = p[9] - p[0], bz = p[11] - p[2]; n.set(0, az * bx - ax * bz, 0); }
        if (n.y < 0) g.setIndex([0, 3, 1, 0, 2, 3]);
        const m = new THREE.Mesh(g, M.strip); m.receiveShadow = true; root.add(m);
      }
    }
  }

  // ------------------------------------------------ troughs, walkway slabs, drainage channels
  for (const side of [1, -1]) {
    for (const [a, b] of DETAIL_X) {
      for (let x0 = a; x0 < b - 1e-6; x0 += 20) {
        const x1 = Math.min(b, x0 + 20), len = x1 - x0, xc = (x0 + x1) / 2;
        // cable trough: lids 0.07 proud of the ground
        const zt = zs(S.trough, side), g0 = gy(xc, zt);
        texBox(len, 0.17, 0.36, M.trough, [xc, g0 - 0.015, zt], len, 1);
        // maintenance walkway slabs
        const zw = zs(S.walk, side);
        texBox(len - 0.04, 0.05, 0.6, M.slab, [xc, gy(xc, zw) + 0.015, zw], len / 1.2, 1);
        // drainage channel (U-shaped, walls proud of the ground)
        const zd = zs(S.drain, side), gd = gy(xc, zd);
        k.box(len, 0.15, 0.07, M.conc, [xc, gd + 0.045, zd - 0.2]);
        k.box(len, 0.15, 0.07, M.conc, [xc, gd + 0.045, zd + 0.2]);
        k.box(len, 0.03, 0.34, M.wet, [xc, gd + 0.02, zd]);
        // occasional lid over the channel
        for (let x = x0 + 4 + r() * 6; x < x1 - 1; x += 9 + r() * 6) texBox(0.95, 0.06, 0.52, M.trough, [x, gd + 0.15, zd], 1, 1);
      }
      // hand-hole covers at the trough ends
      for (const x of [a + 0.5, b - 0.5]) { const zt = zs(S.trough, side); k.boxB(0.8, 0.12, 0.7, M.conc, [x, gy(x, zt) - 0.02, zt]); k.box(0.66, 0.012, 0.56, M.concDark, [x, gy(x, zt) + 0.1, zt]); }
    }
  }

  // ------------------------------------------------ fences
  const colliders = [];
  const addFenceCollider = (x0, x1, z) => {
    for (let a = x0; a < x1 - 1e-6; a += 8) {
      const b = Math.min(x1, a + 8), g = gy((a + b) / 2, z);
      physics.addBox((a + b) / 2, z, b - a, 0.26, 0, g - 1, g + 2.3);
      colliders.push([a, b, z]);
    }
  };
  // old-rail post geometry (rail profile standing up, head facing the tracks) and bar geometry
  const postGeo = (() => {
    const { side, top, head } = railGeo([[0, 0], [1.42, 0]], null, [false, true]);
    const g = mergeGeometries([side, top, head]);
    g.rotateZ(Math.PI / 2); g.rotateY(-Math.PI / 2);
    return g;
  })();
  const postItems = [], meshPostItems = [];
  const buildOldRailFence = (x0, x1, z, faceNorth) => {
    const n = Math.max(1, Math.round((x1 - x0) / 2.4));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      postItems.push({ x, y: gy(x, z) - 0.26, z, ry: faceNorth ? 0 : Math.PI });
    }
    for (let a = x0; a < x1 - 1e-6; a += 20) {
      const b = Math.min(x1, a + 20);
      for (const h of [0.42, 0.9]) {
        const { side, top, head } = railGeo([[a, z], [b, z]], null, [false, false], gy((a + b) / 2, z) + h);
        const g = mergeGeometries([side, top, head]);
        const m = new THREE.Mesh(g, M.whiteFence); m.castShadow = true; m.receiveShadow = true; root.add(m);
      }
      // reflectors on every few posts, facing out of the corridor
      for (let x = a + 1.2; x < b; x += 9.6) {
        const g = gy(x, z);
        k.cyl(0.045, 0.045, 0.012, M.reflR, [x, g + 0.72, z + (faceNorth ? 0.05 : -0.05)], [Math.PI / 2, 0, 0], 12);
      }
    }
    addFenceCollider(x0, x1, z);
  };
  const buildMeshFence = (x0, x1, z, outward /* +1 = outside is +z */) => {
    const n = Math.max(1, Math.round((x1 - x0) / 2.0));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; meshPostItems.push({ x, y: gy(x, z) - 0.1, z }); }
    for (let a = x0; a < x1 - 1e-6; a += 20) {
      const b = Math.min(x1, a + 20), len = b - a, xc = (a + b) / 2, g = gy(xc, z);
      // concrete footing
      k.box(len, 0.2, 0.16, M.conc, [xc, g + 0.02, z]);
      // top & bottom rails
      k.cyl(0.022, 0.022, len, M.fencePost, [xc, g + 1.55, z], [0, 0, Math.PI / 2], 6);
      k.cyl(0.012, 0.012, len, M.fencePost, [xc, g + 0.14, z], [0, 0, Math.PI / 2], 5);
      // mesh panel
      const pg = new THREE.PlaneGeometry(len, 1.42);
      const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.3, uv.getY(i) * 1.42 / 0.3);
      const pm = new THREE.Mesh(pg, M.fenceMesh); pm.position.set(xc, g + 0.84, z + outward * 0.035); pm.receiveShadow = true; pm.castShadow = false;
      ctx.noOutline(pm); root.add(pm);
      if (Math.abs(xc) < 200) for (let x = a + 1; x < b; x += 10) k.cyl(0.04, 0.04, 0.012, M.reflY, [x, g + 1.2, z + outward * 0.05], [Math.PI / 2, 0, 0], 10);
    }
    addFenceCollider(x0, x1, z);
  };
  for (const [a, b] of STRIP_X) {
    // south: white old-rail fence near the town, net fence far out
    const oa = Math.max(a, -110), ob = Math.min(b, 110);
    if (ob > oa) buildOldRailFence(oa, ob, S.fence, true);
    if (a < -110) buildMeshFence(a, Math.min(b, -110), S.fence, 1);
    if (b > 110) buildMeshFence(Math.max(a, 110), b, S.fence, 1);
    // north: net fence
    buildMeshFence(a, b, zs(S.fence, -1), -1);
  }
  {
    const im = makeInstanced(postGeo, M.whiteFence, postItems); if (im) { im.name = 'rw-oldrail-posts'; root.add(im); }
    const pg = new THREE.CylinderGeometry(0.032, 0.032, 1.72, 6, 1, true); pg.translate(0, 0.86, 0);
    const im2 = makeInstanced(pg, M.fencePost, meshPostItems); if (im2) { im2.name = 'rw-net-posts'; root.add(im2); }
  }
  // corridor closures: nobody walks along the tracks out of the crossing zone / station walkway
  physics.addAABB(-17.5, -52.35, -17.2, -33.65, -2, 3);
  physics.addAABB(50.2, -52.35, 50.5, -33.65, -2, 3);
  physics.addAABB(-7.2, -46.5, -6.95, -39.5, -2, 3);
  // walkable ballast top where the player can reach the tracks (crossing zone .. 構内踏切 / platform
  // ramps): feet rest on the stones (y -0.02) instead of sinking to the corridor floor (-0.3)
  physics.addWalkBox((-17.2 + 50.2) / 2, -43, 50.2 + 17.2, 6.7, 0, -0.02);

  // ------------------------------------------------ fence signs
  const fenceSign = (x, south, texture, w, h, y = 0.86) => {
    const z = south ? S.fence + 0.085 : zs(S.fence, -1) - 0.07;
    texPlane(texture, w, h, [x, gy(x, z) + y, z], south ? 0 : Math.PI, M.white, 0.012);
  };
  [-88, -62, -38, 62, 86].forEach((x, i) => fenceSign(x, true, i % 2 ? T.sign.kiken : T.sign.tachiiri, 0.6, 0.45));
  [-84, -56, -30, 58, 82].forEach((x, i) => fenceSign(x, false, i % 2 ? T.sign.tachiiri : T.sign.kiken, 0.6, 0.45, 1.05));
  fenceSign(-19.4, true, T.sign.emergency, 0.5, 0.625, 0.9);
  fenceSign(-19.4, false, T.sign.emergency, 0.5, 0.625, 1.05);

  // ------------------------------------------------ signals
  const signals = [];
  const buildSignal = (o) => {
    const { x, z, face, label } = o;
    const gyb = o.between ? -0.05 : gy(x, z);
    const headY = o.headY, mastTop = headY + 0.72;
    k.boxB(0.42, 0.34, 0.42, M.conc, [x, gyb - 0.2, z]);
    k.cyl(0.07, 0.078, mastTop - gyb - 0.14, M.steel, [x, (mastTop + gyb + 0.14) / 2, z], null, 10);
    k.cyl(0.055, 0.08, 0.06, M.steelDark, [x, mastTop + 0.03, z], null, 10);
    // junction box on the mast
    k.rbox(0.2, 0.3, 0.16, 0.03, M.box, [x - face * 0.14, gyb + 0.9, z]);
    if (!o.between) { // ladder for the tall home signals
      for (const s of [-1, 1]) k.box(0.025, headY - 0.6 - gyb, 0.025, M.steelDark, [x - face * 0.16, (headY - 0.6 + gyb) / 2 + 0.3, z + s * 0.17]);
      for (let y = gyb + 0.5; y < headY - 0.5; y += 0.3) k.box(0.02, 0.02, 0.34, M.steelDark, [x - face * 0.16, y, z]);
      k.box(0.5, 0.04, 0.6, M.steelDark, [x - face * 0.05, headY - 0.62, z]);
    }
    const rotY = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    const hx = x + face * 0.13, hz = z + (o.headDz || 0);
    const head = k.group([hx, headY, hz], rotY);
    const kh = ctx.kit(head);
    kh.rbox(0.28, 1.0, 0.2, 0.04, M.steelDark, [0, 0, -0.12]);
    kh.rbox(0.4, 1.12, 0.05, 0.04, M.sigBoard, [0, 0, 0]);
    const hoodGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14, 1, true);
    const lens = [[0.34, M.lensG], [0, M.lensY], [-0.34, M.lensR]];
    for (const [ly, lm] of lens) {
      kh.cyl(0.082, 0.082, 0.02, lm, [0, ly, 0.035], [Math.PI / 2, 0, 0], 16);
      const hood = kh.mesh(hoodGeo, M.sigHood, [0, ly, 0.105], [Math.PI / 2, 0, 0]);
      hood.castShadow = true;
    }
    // id plate under the head
    texPlane(T.sign.plate([{ t: label, s: 50 }], 'sig-' + label, 256, 96), 0.3, 0.11, [hx + face * 0.02, headY - 0.7, hz], rotY, M.white, 0.012);
    // lit lamps (dynamic)
    const dyn = new THREE.Group(); dyn.position.set(hx, headY, hz); dyn.rotation.y = rotY;
    const disc = new THREE.CylinderGeometry(0.078, 0.078, 0.012, 16);
    const litG = new THREE.Mesh(disc, M.litG); litG.position.set(0, 0.34, 0.05); litG.rotation.x = Math.PI / 2;
    const litR = new THREE.Mesh(disc, M.litR); litR.position.set(0, -0.34, 0.05); litR.rotation.x = Math.PI / 2;
    // soft glow cards in front of the lamps
    const glowTex = T.glow;
    const gG = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat.emissive('#5ff0b8', 1.4, { map: glowTex, transparent: true, depthWrite: false }));
    gG.position.set(0, 0.34, 0.07);
    const gR = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat.emissive('#ff5646', 1.4, { map: glowTex, transparent: true, depthWrite: false }));
    gR.position.set(0, -0.34, 0.07);
    litG.add(gG); gG.rotation.x = -Math.PI / 2; gG.position.set(0, 0.02, 0);
    litR.add(gR); gR.rotation.x = -Math.PI / 2; gR.position.set(0, 0.02, 0);
    dyn.add(litG); dyn.add(litR);
    ctx.noOutline(gG); ctx.noOutline(gR);
    ctx.add(dyn);
    litG.visible = false; litR.visible = true;
    physics.addCylinder(x, z, 0.24, gyb - 1, mastTop);
    signals.push({ ...o, litG, litR, state: false });
  };
  // glow texture (radial)
  T.glow = ctx.tex.draw(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { key: 'rw-glow' });
  buildSignal({ id: 'A-start', track: 'A', x: -4.5, z: -43.0, face: 1, headY: 3.35, label: '上り出発', between: true, kind: 'start', dir: -1 });
  buildSignal({ id: 'B-start', track: 'B', x: 44.5, z: -43.0, face: -1, headY: 3.35, label: '下り出発', between: true, kind: 'start', dir: 1 });
  buildSignal({ id: 'A-home', track: 'A', x: 140, z: -39.0, face: 1, headY: 3.9, label: '上り場内', kind: 'home', dir: -1, headDz: -0.1 });
  buildSignal({ id: 'B-home', track: 'B', x: -163, z: -47.0, face: -1, headY: 3.9, label: '下り場内', kind: 'home', dir: 1, headDz: 0.1 });

  // ------------------------------------------------ km posts (白地に黒字, every 100 m)
  const kmPost = (x, south) => {
    const z = south ? -38.92 : -47.08, g = gy(x, z);
    const kmv = 8.5 + (x + 60) / 1000, km = Math.floor(kmv + 1e-6), hm = Math.round((kmv - km) * 10) % 10;
    k.boxB(0.17, 0.78, 0.17, M.white, [x, g - 0.2, z]);
    k.box(0.2, 0.05, 0.2, M.concDark, [x, g - 0.02, z]);
    const tx = T.sign.km(km, hm);
    // faces toward both running directions + the town side
    for (const [dx, dz, ry] of [[0.087, 0, Math.PI / 2], [-0.087, 0, -Math.PI / 2], [0, south ? 0.087 : -0.087, south ? 0 : Math.PI]]) {
      T.signMesh(k, tx, 0.15, 0.225, [x + dx, g + 0.42, z + dz], [0, ry, 0]);
    }
  };
  for (const x of [-360, -260, -160, -60, 240, 340]) kmPost(x, true);
  kmPost(140, false);

  // ------------------------------------------------ speed limit signs
  const speedSign = (x, south, v) => {
    const z = south ? -38.92 : -47.08, g = gy(x, z), face = south ? 1 : -1; // A (south) faces east, B faces west
    k.boxB(0.26, 0.2, 0.26, M.conc, [x, g - 0.1, z]);
    k.cyl(0.035, 0.035, 1.75, M.steel, [x, g + 0.9, z], null, 8);
    texPlane(T.sign.speed(v), 0.4, 0.4, [x + face * 0.05, g + 1.62, z], face > 0 ? Math.PI / 2 : -Math.PI / 2, M.signBack, 0.02);
  };
  speedSign(128, true, 45); speedSign(-40, true, 60);
  speedSign(56, false, 45); speedSign(-110, false, 60);

  // ------------------------------------------------ equipment cabinets with conduits to the trough
  const cabinet = (x, side, big = true) => {
    const z = zs(S.equip, side), g = gy(x, z), w = big ? 0.86 : 0.56, h = big ? 1.32 : 0.86, d = big ? 0.5 : 0.36;
    k.boxB(w + 0.2, 0.14, d + 0.16, M.conc, [x, g - 0.02, z]);
    k.rbox(w, h, d, 0.035, M.box, [x, g + 0.12 + h / 2, z]);
    k.rbox(w + 0.08, 0.05, d + 0.1, 0.02, M.steelDark, [x, g + 0.12 + h + 0.02, z]);
    const faceZ = z + side * (d / 2 + 0.004);
    T.signMesh(k, T.sign.box, w * 0.92, h * 0.94, [x, g + 0.12 + h / 2, faceZ], [0, side > 0 ? 0 : Math.PI, 0]);
    // conduit down into the ground and along it to the trough
    const zt = zs(S.trough, side), zc0 = z - side * (d / 2 + 0.05);
    k.cyl(0.035, 0.035, 0.5, M.pipeDark, [x + w * 0.3, g + 0.2, zc0], null, 8);
    k.box(0.07, 0.06, Math.abs(zt - zc0), M.pipeDark, [x + w * 0.3, g + 0.02, (zt + zc0) / 2]);
    physics.addBox(x, z, w + 0.2, d + 0.16, 0, g - 1, g + h + 0.2);
  };
  cabinet(-32, 1); cabinet(-30.8, 1, false); cabinet(-76, 1); cabinet(58, 1); cabinet(59.2, 1, false); cabinet(132, 1);
  cabinet(-38, -1); cabinet(72, -1); cabinet(120, -1); cabinet(121.1, -1, false); cabinet(-166, -1);

  // ------------------------------------------------ white delineator posts with red reflectors at the corridor ends
  for (const [x, side] of [[-20.2, 1], [-23.4, 1], [-20.2, -1], [-23.4, -1], [53, 1], [56.2, 1], [53, -1], [56.2, -1]]) {
    const z = zs(-38.95, side), g = gy(x, z);
    k.boxB(0.07, 0.72, 0.07, M.white, [x, g - 0.12, z]);
    for (const s of [-1, 1]) k.cyl(0.03, 0.03, 0.01, M.reflR, [x + s * 0.04, g + 0.48, z], [0, 0, Math.PI / 2], 10);
  }

  // ------------------------------------------------ spare rails on wooden blocks, stacked spare sleepers
  const spareRails = (x0, x1, side, dzs) => {
    const z0 = zs(S.equip, side);
    for (let x = x0 + 0.6; x < x1; x += 4.1) k.boxB(0.14, 0.09, 0.62, M.wood, [x, gy(x, z0) - 0.01, z0]);
    for (const dz of dzs) {
      const { side: sg, top, head } = railGeo([[x0, z0 + dz], [x1, z0 + dz]], null, [true, true], gy(x0, z0) + 0.08);
      for (const m of [new THREE.Mesh(sg, M.railSide), new THREE.Mesh(top, M.railSide), new THREE.Mesh(head, M.railSide)]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
    }
  };
  spareRails(78, 103, -1, [-0.12, 0.12]);
  spareRails(-72, -47, 1, [-0.14, 0.1]);
  {
    const x0 = -86.5, z0 = zs(S.equip, 1) - 0.05, g = gy(x0, z0);
    for (let layer = 0; layer < 3; layer++) {
      const y = g + 0.06 + layer * 0.22;
      for (const dx of [-0.8, 0.8]) k.boxB(0.1, 0.05, 0.62, M.wood, [x0 + dx, y - 0.05, z0]);
      for (const dz of [-0.14, 0.14]) {
        const m = k.box(2.0, 0.17, 0.22, M.pc, [x0 + (r() - 0.5) * 0.06, y + 0.085, z0 + dz]);
        m.rotation.y = (r() - 0.5) * 0.03;
      }
    }
    physics.addBox(x0, z0, 2.2, 0.8, 0, g - 1, g + 1);
  }

  // ------------------------------------------------ catenary pole colliders
  for (const c of cat.colliders) physics.addCylinder(c.x, c.z, c.r, -2, 9);

  return { signals, fenceColliders: colliders, S, zs, STRIP_X, DETAIL_X, inRanges };
}
