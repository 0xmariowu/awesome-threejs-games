// Static petals lying on surfaces: wind-blown streaks, small piles against curbs / walls / gutters,
// clusters under every sakura, road corners, platform corners & fence bases, benches, vending
// machine tops, café tables and a few stuck to the café window. One InstancedMesh (toon material).
import * as THREE from 'three';

export function createGroundCollector(ctx, env) {
  const { r } = env;
  const cap = env.capacity;
  const P = new Float32Array(cap * 3), Q = new Float32Array(cap * 4), S = new Float32Array(cap), T = new Float32Array(cap);
  let n = 0;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ax = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const WIND = Math.atan2(0.35, 0.9); // wind heading (angle in XZ, +X = 0)
  const wdx = Math.cos(WIND), wdz = Math.sin(WIND);

  function tone() {
    const u = r();
    if (u < 0.05) return 1.3 + r() * 0.2;   // aged, slightly browned
    if (u < 0.12) return 1.0 + r() * 0.2;   // deeper pink
    return Math.pow(r(), 1.3);
  }
  /** one petal lying on a surface at height y (surface), optional tilt (rad sigma), stack lift */
  function put(x, y, z, o = {}) {
    if (n >= cap) return false;
    const size = (o.size ?? 0.031) * (0.8 + r() * 0.45);
    const tilt = Math.abs((r() + r() + r() - 1.5) / 1.5) * (o.tilt ?? 0.28);
    const yaw = o.yaw ?? r() * Math.PI * 2;
    const ta = r() * Math.PI * 2;
    ax.set(Math.cos(ta), 0, Math.sin(ta));
    qa.setFromAxisAngle(up, yaw); qb.setFromAxisAngle(ax, tilt); qb.multiply(qa);
    if (o.normal) { // stuck onto a vertical surface: rotate +Y onto the normal
      const q0 = new THREE.Quaternion().setFromUnitVectors(up, o.normal);
      qb.premultiply(q0);
    }
    const lift = (o.lift ?? 0.016) + Math.sin(tilt) * size * 0.5 + (o.stack ?? 0);
    const i3 = n * 3, i4 = n * 4;
    if (o.normal) { P[i3] = x + o.normal.x * lift; P[i3 + 1] = y + o.normal.y * lift; P[i3 + 2] = z + o.normal.z * lift; }
    else { P[i3] = x; P[i3 + 1] = y + lift; P[i3 + 2] = z; }
    Q[i4] = qb.x; Q[i4 + 1] = qb.y; Q[i4 + 2] = qb.z; Q[i4 + 3] = qb.w;
    S[n] = size; T[n] = o.tone ?? tone();
    n++;
    return true;
  }
  const gauss = () => (r() + r() + r() + r() - 2) / 0.8165; // ~N(0,1)

  /** place on the generic ground surface (env.surf -> y or null) */
  function onGround(x, z, o = {}) { const y = env.surf(x, z, o.mode); if (y === null || y === undefined) return false; return put(x, y, z, o); }

  /** Gaussian ellipse cluster (sx along `ang`, sz across). pile: dome height (m) for stacking. */
  function cluster(cx, cz, sx, sz, ang, count, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const u = gauss() * sx, v = gauss() * sz;
      const x = cx + u * c - v * s, z = cz + u * s + v * c;
      if (o.reject && o.reject(x, z)) continue;
      const d2 = (u * u) / (sx * sx) + (v * v) / (sz * sz);
      const stack = o.pile ? o.pile * Math.max(0, 1 - d2 / 2.2) * r() : 0;
      if (onGround(x, z, { ...o, stack, tilt: o.pile ? 0.55 : o.tilt })) placed++;
    }
    return placed;
  }

  /** wind-blown streak: tapered, denser at the downwind head (ang = direction the wind pushes). */
  function streak(cx, cz, ang, len, width, count, o = {}) {
    const c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < count; i++) {
      const u = Math.pow(r(), 0.7);                 // 0 = tail, 1 = head (denser)
      const along = (u - 0.5) * len;
      const w = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * 0.5;
      const v = gauss() * w * 0.6 + Math.sin(along * 1.7) * width * 0.12;
      const x = cx + along * c - v * s, z = cz + along * s + v * c;
      if (o.reject && o.reject(x, z)) continue;
      onGround(x, z, o);
    }
  }

  /** strip along a segment with clumpy density; offsets drawn from band [o0,o1] on side(s). */
  function strip(ax_, az_, bx_, bz_, perM, o = {}) {
    const dx = bx_ - ax_, dz = bz_ - az_, len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const tx = dx / len, tz = dz / len, nx = -tz, nz = tx;
    const ph1 = r() * 10, ph2 = r() * 10, ph3 = r() * 10;
    const count = Math.round(len * perM);
    const band = o.band || [0.02, 0.3];
    const sides = o.sides || [-1, 1];
    for (let i = 0; i < count; i++) {
      const sAl = r() * len;
      // clumps and gaps: product of slow sines, sharpened
      const d = Math.max(0, 0.5 + 0.5 * Math.sin(sAl * 0.83 + ph1) * Math.sin(sAl * 0.29 + ph2) + 0.25 * Math.sin(sAl * 2.1 + ph3));
      if (r() > Math.pow(d, 1.6) * 1.25) continue;
      const side = sides[Math.floor(r() * sides.length)];
      const off = band[0] + Math.pow(r(), o.hug ?? 2.2) * (band[1] - band[0]);
      const x = ax_ + tx * sAl + nx * off * side, z = az_ + tz * sAl + nz * off * side;
      if (o.reject && o.reject(x, z)) continue;
      onGround(x, z, o);
    }
    // small piles every few metres (against the edge)
    if (o.piles) {
      const np = Math.floor(len / o.piles);
      for (let k = 0; k < np; k++) {
        if (r() > 0.6) continue;
        const sAl = r() * len, side = sides[Math.floor(r() * sides.length)];
        const off = band[0] + 0.06;
        const x = ax_ + tx * sAl + nx * off * side, z = az_ + tz * sAl + nz * off * side;
        cluster(x, z, 0.16 + r() * 0.18, 0.06 + r() * 0.05, Math.atan2(tz, tx), 18 + Math.floor(r() * 26), { ...o, pile: 0.012 + r() * 0.014 });
      }
    }
  }

  /** uniform scatter in an axis-aligned rect */
  function scatter(x0, z0, x1, z1, count, o = {}) {
    for (let i = 0; i < count; i++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (o.reject && o.reject(x, z)) continue;
      onGround(x, z, o);
    }
  }

  /** petals on a flat top (bench seat, table, vending top) — local rect w×d rotated by rotY, at y. */
  function onTop(cx, y, cz, rotY, w, d, count, o = {}) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    // gather a bit toward one end / the back edge (where the wind drops them)
    const biasX = (r() - 0.5) * 0.6, biasZ = -0.3 + r() * 0.2;
    for (let i = 0; i < count; i++) {
      let lx = (r() - 0.5) * w, lz = (r() - 0.5) * d;
      if (r() < 0.45) { lx = (biasX + gauss() * 0.18) * w * 0.5; lz = (biasZ + gauss() * 0.25) * d * 0.5; }
      lx = Math.max(-w / 2, Math.min(w / 2, lx)); lz = Math.max(-d / 2, Math.min(d / 2, lz));
      const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
      put(x, y, z, { lift: 0.006, tilt: 0.18, size: o.size ?? 0.031 });
    }
  }
  /** round table top */
  function onDisc(cx, y, cz, rad, count) {
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
      put(cx + Math.cos(a) * d, y, cz + Math.sin(a) * d, { lift: 0.005, tilt: 0.15, size: 0.027 });
    }
  }
  /** petals stuck to a vertical glass pane (window frame: centre x,y,z, rotY faces outward +Z local) */
  function onPane(win, count) {
    const c = Math.cos(win.rotY), s = Math.sin(win.rotY);
    const nrm = new THREE.Vector3(s, 0, c);
    for (let i = 0; i < count; i++) {
      let lx, ly;
      const u = r();
      if (u < 0.35) { lx = (r() < 0.5 ? -1 : 1) * (win.w / 2 - Math.abs(gauss()) * 0.25); ly = -win.h / 2 + Math.abs(gauss()) * 0.3; } // lower corners
      else if (u < 0.55) { lx = (r() - 0.5) * win.w * 0.95; ly = -win.h / 2 + r() * 0.12; }          // along the sill
      else { lx = (r() - 0.5) * win.w * 0.9; ly = (r() - 0.35) * win.h * 0.8; }
      lx = Math.max(-win.w / 2 + 0.03, Math.min(win.w / 2 - 0.03, lx)); ly = Math.max(-win.h / 2 + 0.03, Math.min(win.h / 2 - 0.03, ly));
      const x = win.x + lx * c, z = win.z - lx * s, y = win.y + ly;
      put(x, y, z, { normal: nrm, lift: 0.012, tilt: 0.12, size: 0.032 });
    }
  }

  function build(material) {
    const geo = new THREE.PlaneGeometry(0.72, 1, 1, 1).rotateX(-Math.PI / 2); // lying in XZ, normal +Y, length along Z
    const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, n));
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const cPale = new THREE.Color(env.colors.pale), cPink = new THREE.Color(env.colors.pink), cDeep = new THREE.Color(env.colors.deep), cOld = new THREE.Color(env.colors.old);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      p.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); q.set(Q[i * 4], Q[i * 4 + 1], Q[i * 4 + 2], Q[i * 4 + 3]); sc.setScalar(S[i]);
      m.compose(p, q, sc); mesh.setMatrixAt(i, m);
      const t = T[i];
      if (t <= 1) col.copy(cPale).lerp(cPink, t);
      else if (t < 1.25) col.copy(cPink).lerp(cDeep, (t - 1) * 4);
      else col.copy(cPink).lerp(cOld, 0.55 + (t - 1.3) * 1.5);
      mesh.setColorAt(i, col);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.name = 'petals-ground';
    return mesh;
  }

  return { put, onGround, cluster, streak, strip, scatter, onTop, onDisc, onPane, build, get count() { return n; }, WIND, wdx, wdz, gauss };
}
