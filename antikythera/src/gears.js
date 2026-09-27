// gears.js
const SETS = [
  [0.000575, ['b1']],
  [0.000484, ['b2', 'c1', 'l1']],
  [0.000451, ['c2', 'd1']],
  [0.000478, ['d2', 'e2']],
  [0.0005255, ['e5', 'k1', 'k2', 'e6']],
  [0.000559, ['e1', 'b3']],
  [0.000495, ['l2', 'm1']],
  [0.000513, ['m2', 'n1']],
  [0.000417, ['n3', 'o1']],
  [0.000466, ['m3', 'e3']],
  [0.000529, ['e4', 'f1']],
  [0.000517, ['f2', 'g1']],
  [0.0004475, ['g2', 'h1']],
  [0.000442, ['h2', 'i1']],
];
const MODULES = {};
for (const [m, ids] of SETS) for (const id of ids) MODULES[id] = m;
const MODULE = 0.00058;
const moduleOf = (id) => MODULES[id] ?? MODULE;

const pitchRadius = (N, m = MODULE) => (N * m) / 2;

const HERO_GEARS = [
  { id: 'b1', N: 224, spokes: 4, thickness: 0.0027, m: moduleOf('b1') },
  { id: 'd2', N: 127, spokes: 4, thickness: 0.0013, m: moduleOf('d2') },
  { id: 'e3', N: 223, spokes: 0, thickness: 0.0014, m: moduleOf('e3') },
];

const BORE = 0.00108;

const TAU$7 = Math.PI * 2;
const clamp$8 = (x, a, b) => (x < a ? a : x > b ? b : x);

function wheelDims(N, spokes = 0, m = MODULE) {
  const r = (N * m) / 2, rootR = r - 1.15 * m, tipR = r + m;
  const hubR = Math.max(0.006, r * 0.22), rimIn = rootR - Math.max(0.0036, r * 0.13);
  if (!(spokes > 0) || rimIn - hubR < 0.004) return { r, rootR, tipR, hubR: 0, rimIn: 0, sw: 0, spokes: 0 };
  return { r, rootR, tipR, hubR, rimIn, sw: Math.max(0.0032, r * 0.16) / 2, spokes: Math.min(spokes | 0, 8) };
}

function wheelShape(N, { spokes = 0, bore = BORE, m = MODULE } = {}) {
  const D = wheelDims(N, spokes, m), rr = D.rootR, rt = D.tipR, pa = TAU$7 / N;
  const shape = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = i * pa;
    const x0 = Math.cos(a - pa * 0.5) * rr, y0 = Math.sin(a - pa * 0.5) * rr;
    if (i === 0) shape.moveTo(x0, y0); else shape.lineTo(x0, y0);
    shape.lineTo(Math.cos(a - pa * 0.12) * rt, Math.sin(a - pa * 0.12) * rt);
    shape.lineTo(Math.cos(a + pa * 0.12) * rt, Math.sin(a + pa * 0.12) * rt);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(bore, 0); hole.lineTo(0, bore); hole.lineTo(-bore, 0); hole.lineTo(0, -bore); hole.lineTo(bore, 0);
  shape.holes.push(hole);
  if (D.spokes > 0) {
    const { rimIn, hubR, sw } = D, sector = TAU$7 / D.spokes, hf = clamp$8(1.7 - 0.1 * D.spokes, 1.0, 1.4);
    const offO = Math.asin(Math.min(0.9, (sw * 0.8) / rimIn)), offI = Math.asin(Math.min(0.9, (sw * hf) / hubR));
    const f = Math.min(0.0026, (rimIn - hubR) * 0.22);
    const fO = Math.min(f, (sector - 2 * offO) * rimIn * 0.4), fI = Math.min(f, Math.max(0, sector - 2 * offI) * hubR * 0.4);
    const at2 = (rad, ang) => new THREE.Vector2(rad * Math.cos(ang), rad * Math.sin(ang));
    const toward = (p, q, d) => p.clone().add(q.clone().sub(p).setLength(d));
    for (let k = 0; k < D.spokes; k++) {
      const a0 = k * sector, a1 = (k + 1) * sector;
      const c1 = at2(rimIn, a0 + offO), c2 = at2(rimIn, a1 - offO), c3 = at2(hubR, a1 - offI), c4 = at2(hubR, a0 + offI);
      const hp = new THREE.Path();
      hp.absarc(0, 0, rimIn, a0 + offO + fO / rimIn, a1 - offO - fO / rimIn, false);
      const e2 = toward(c2, c3, fO), e3 = toward(c3, c2, fI), i3 = at2(hubR, a1 - offI - fI / hubR);
      hp.quadraticCurveTo(c2.x, c2.y, e2.x, e2.y);
      hp.lineTo(e3.x, e3.y);
      hp.quadraticCurveTo(c3.x, c3.y, i3.x, i3.y);
      hp.absarc(0, 0, hubR, a1 - offI - fI / hubR, a0 + offI + fI / hubR, true);
      const e4 = toward(c4, c1, fI), e1 = toward(c1, c4, fO), o1 = at2(rimIn, a0 + offO + fO / rimIn);
      hp.quadraticCurveTo(c4.x, c4.y, e4.x, e4.y);
      hp.lineTo(e1.x, e1.y);
      hp.quadraticCurveTo(c1.x, c1.y, o1.x, o1.y);
      shape.holes.push(hp);
    }
  }
  return shape;
}

function filer(N, id, D) {
  const pa = TAU$7 / N, sid = String(id);
  const rng = makeRng$1(N * 131 + sid.charCodeAt(0) * 7 + (sid.charCodeAt(1) || 0));
  const tooth = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) tooth[i] = rng() * 2 - 1;
  const { rootR, tipR, hubR, rimIn } = D;
  return (x, y) => {
    const r = Math.hypot(x, y);
    if (r < 1e-6) return [x, y];
    let th = Math.atan2(y, x), rn = r;
    if (r > rootR + 1e-6) {
      const k = Math.round(th / pa);
      const kk = (((k % N) + N) % N) * 4;
      const phi = th - k * pa;
      const f = Math.min(1, (r - rootR) / (tipR - rootR));
      th = k * pa + phi * (1 + 0.07 * tooth[kk] * f) + pa * f * (0.018 * tooth[kk + 1] + 0.02 * tooth[kk + 2] * Math.sign(phi));
      rn = r + f * f * 0.00004 * tooth[kk + 3];
    } else if (hubR > 0 && r > hubR - 1e-4 && r < rimIn + 1e-4) {
      rn = r + 0.00007 * (Math.sin(th * 7 + N) * 0.5 + Math.sin(th * 13 + r * 900 + N * 0.3) * 0.5);
      th += 0.0009 * Math.sin(r * 1500 + th * 5 + N);
    } else return [x, y];
    return [rn * Math.cos(th), rn * Math.sin(th)];
  };
}

function plateGeometry(shape, th, { segs = 3, curveSegs = 12, file = null } = {}) {
  const h = th / 2;
  const ex = shape.extractPoints(curveSegs);
  const loops = [];
  [ex.shape, ...ex.holes].forEach((pts, li) => {
    const P = [];
    for (const p of pts) {
      const q = file ? file(p.x, p.y) : [p.x, p.y];
      const l = P[P.length - 1];
      if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-7) P.push(q);
    }
    while (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 1e-7) P.pop();
    if (P.length < 3) return;
    let A = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; A += a[0] * b[1] - b[0] * a[1]; }
    if ((li === 0) !== (A > 0)) P.reverse();
    const ext = Math.sqrt(Math.abs(A) / 2);
    const rh = li === 0 ? 0.00012 : Math.min(0.00024, ext * 0.12);
    const rv = Math.min(li === 0 ? 0.00024 : 0.00026, h * 0.45);
    loops.push({ P, rh, rv });
  });
  const profile = (rh, rv) => {
    const out = [];
    for (let k = segs; k >= 0; k--) {
      const a = (k / segs) * (Math.PI / 2), c = Math.cos(a) / rh, s = Math.sin(a) / rv, L = Math.hypot(c, s);
      out.push([-rh * (1 - Math.cos(a)), -(h - rv) - rv * Math.sin(a), c / L, -s / L]);
    }
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * (Math.PI / 2), c = Math.cos(a) / rh, s = Math.sin(a) / rv, L = Math.hypot(c, s);
      out.push([-rh * (1 - Math.cos(a)), (h - rv) + rv * Math.sin(a), c / L, s / L]);
    }
    return out;
  };
  const pos = [], nor = [], idx = [], capTop = [], capBot = [], faces = [];
  for (const { P, rh, rv } of loops) {
    const n = P.length, pr = profile(rh, rv), M = pr.length;
    const colIn = new Int32Array(n), colOut = new Int32Array(n);
    const emit = (p, mx, my, nx, ny) => {
      const base = pos.length / 3;
      for (const [o, z, cn, zn] of pr) {
        pos.push(p[0] + mx * o, p[1] + my * o, z);
        nor.push(nx * cn, ny * cn, zn);
      }
      return base;
    };
    for (let i = 0; i < n; i++) {
      const p = P[i], a = P[(i + n - 1) % n], b = P[(i + 1) % n];
      let ex0 = p[0] - a[0], ey0 = p[1] - a[1], l = Math.hypot(ex0, ey0);
      ex0 /= l; ey0 /= l;
      let fx = b[0] - p[0], fy = b[1] - p[1];
      l = Math.hypot(fx, fy); fx /= l; fy /= l;
      const nix = ey0, niy = -ex0, nox = fy, noy = -fx;
      let mx = nix + nox, my = niy + noy;
      const m2 = mx * mx + my * my;
      if (m2 < 1e-6) { mx = nix; my = niy; } else { mx *= 2 / m2; my *= 2 / m2; }
      const ml = Math.hypot(mx, my);
      if (ml > 3) { mx *= 3 / ml; my *= 3 / ml; }
      if (ex0 * fx + ey0 * fy < 0.88) {
        colIn[i] = emit(p, mx, my, nix, niy);
        colOut[i] = emit(p, mx, my, nox, noy);
      } else {
        let ax = nix + nox, ay = niy + noy;
        const al = Math.hypot(ax, ay) || 1;
        ax /= al; ay /= al;
        colIn[i] = colOut[i] = emit(p, mx, my, ax, ay);
      }
      capBot.push(colOut[i]);
      capTop.push(colOut[i] + M - 1);
      faces.push(new THREE.Vector2(p[0] + mx * pr[M - 1][0], p[1] + my * pr[M - 1][0]));
    }
    for (let i = 0; i < n; i++) {
      const A = colOut[i], B = colIn[(i + 1) % n];
      for (let k = 0; k < M - 1; k++) idx.push(A + k, B + k, B + k + 1, A + k, B + k + 1, A + k + 1);
    }
  }
  const contours = [];
  let o = 0;
  for (const { P } of loops) { contours.push(faces.slice(o, o + P.length)); o += P.length; }
  const tris = THREE.ShapeUtils.triangulateShape(contours[0], contours.slice(1));
  for (const [a, b, c] of tris) {
    const A = faces[a], B = faces[b], C = faces[c];
    if ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) > 0) idx.push(capTop[a], capTop[b], capTop[c], capBot[a], capBot[c], capBot[b]);
    else idx.push(capTop[a], capTop[c], capTop[b], capBot[a], capBot[b], capBot[c]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function wheelPlate(N, { spokes = 0, thickness = 0.002, id = 'w' + N, bore = BORE * 1.04, m = MODULE, segs = 3 } = {}) {
  const D = wheelDims(N, spokes, m);
  return plateGeometry(wheelShape(N, { spokes: D.spokes, bore, m }), thickness, { segs, file: filer(N, id, D) });
}

function boreCap(rIn, segs, bore = BORE) {
  const s = new THREE.Shape();
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TAU$7;
    if (i === 0) s.moveTo(rIn * Math.cos(a), rIn * Math.sin(a)); else s.lineTo(rIn * Math.cos(a), rIn * Math.sin(a));
  }
  s.closePath();
  const h = new THREE.Path();
  h.moveTo(bore, 0); h.lineTo(0, -bore); h.lineTo(-bore, 0); h.lineTo(0, bore); h.lineTo(bore, 0);
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 1);
  g.deleteAttribute('uv');
  return g;
}

function boreTube(z0, z1, bore = BORE) {
  const C = [[bore, 0], [0, bore], [-bore, 0], [0, -bore]];
  const pos = [], nor = [], idx = [];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = C[i], [x1, y1] = C[(i + 1) % 4];
    let nx = -(x0 + x1), ny = -(y0 + y1);
    const l = Math.hypot(nx, ny);
    nx /= l; ny /= l;
    const b = i * 4;
    pos.push(x0, y0, z0, x1, y1, z0, x1, y1, z1, x0, y0, z1);
    for (let k = 0; k < 4; k++) nor.push(nx, ny, 0);
    idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function turnGeo(pts, segs) {
  const P = pts.map((p) => [Math.max(0, p[0]), p[1], !!p[2]]);
  const n = P.length, seg = [];
  for (let j = 0; j < n - 1; j++) {
    const dr = P[j + 1][0] - P[j][0], dz = P[j + 1][1] - P[j][1], L = Math.hypot(dr, dz);
    seg.push(L > 1e-12 ? [dz / L, -dr / L] : null);
  }
  for (let j = 0; j < seg.length; j++) if (!seg[j]) seg[j] = seg[j - 1] || seg[j + 1] || [0, 1];
  const rings = [];
  for (let j = 0; j < n; j++) {
    const a = j > 0 ? seg[j - 1] : null, b = j < n - 1 ? seg[j] : null;
    if (a && b && P[j][2]) {
      const x = a[0] + b[0], y = a[1] + b[1], L = Math.hypot(x, y) || 1;
      rings.push([P[j], x / L, y / L, true]);
    } else if (a && b) {
      rings.push([P[j], a[0], a[1], false], [P[j], b[0], b[1], true]);
    } else {
      const s = a || b;
      rings.push([P[j], s[0], s[1], true]);
    }
  }
  const nR = rings.length, pos = new Float32Array(nR * segs * 3), nor = new Float32Array(nR * segs * 3), idx = [];
  for (let k = 0; k < nR; k++) {
    const [p, nr, nz] = rings[k];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU$7, c = Math.cos(a), s = Math.sin(a), v = (k * segs + i) * 3;
      pos[v] = p[0] * c; pos[v + 1] = p[0] * s; pos[v + 2] = p[1];
      nor[v] = nr * c; nor[v + 1] = nr * s; nor[v + 2] = nz;
    }
  }
  for (let k = 0; k < nR - 1; k++) {
    if (!rings[k][3] || (rings[k][0][0] < 1e-9 && rings[k + 1][0][0] < 1e-9)) continue;
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % segs, a = k * segs + i, b = k * segs + i1, c = (k + 1) * segs + i, d = (k + 1) * segs + i1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function gearGeometry(N, opts = {}) {
  const th = opts.thickness ?? 0.002, h = th / 2, hb = h + 0.00045;
  const hero = HERO_GEARS.find((g) => g.N === N);
  const id = opts.id || (hero ? hero.id : 'w' + N);
  const m = opts.m ?? (hero ? hero.m : MODULE);
  const D = wheelDims(N, opts.spokes ?? 0, m), spokes = D.spokes;
  const bossR = spokes ? Math.min(D.hubR * 0.8, 0.0068) : clamp$8(D.rootR * 0.45, 0.0021, 0.0058);
  const segs = Math.round(clamp$8(D.r * 2200, 48, 160)), bsegs = Math.round(clamp$8(bossR * 9000, 24, 64));
  const parts = [wheelPlate(N, { spokes, thickness: th, id, m })];
  const both = (g) => { parts.push(g, g.clone().rotateX(Math.PI)); };
  if (spokes) {
    both(turnGeo([[D.rootR - 0.00045, h], [D.rootR - 0.00045, h + 0.00012], [D.rootR - 0.00055, h + 0.00022],
      [D.rimIn + 0.00045, h + 0.00022], [D.rimIn + 0.00035, h + 0.00012], [D.rimIn + 0.00035, h]], segs));
  }
  const fr = 0.0003, inR = 0.0013, boss = [];
  for (let i = 0; i <= 3; i++) { const a = -Math.PI / 2 - (i / 3) * (Math.PI / 2); boss.push([bossR + fr + fr * Math.cos(a), h + fr + fr * Math.sin(a), 1]); }
  boss.push([bossR, hb - 0.0001, 1], [bossR - 0.0001, hb, 1], [inR, hb]);
  both(turnGeo(boss, bsegs));
  both(boreCap(inR, bsegs).translate(0, 0, hb));
  parts.push(boreTube(-hb, hb));
  const dome = (rad) => {
    const p = [[0, 0]];
    for (let i = 0; i <= 3; i++) { const a = (i / 3) * (Math.PI / 2); p.push([rad * Math.cos(a), rad * 0.56 * Math.sin(a), 1]); }
    return turnGeo(p, 10);
  };
  const riv = [];
  if (spokes) {
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * TAU$7;
      riv.push([(D.rimIn + 0.0012) * Math.cos(a), (D.rimIn + 0.0012) * Math.sin(a), h + 0.00022, 0.00036]);
      riv.push([(D.hubR - 0.0008) * Math.cos(a), (D.hubR - 0.0008) * Math.sin(a), h, 0.00032]);
    }
  }
  const ring = 0.0019, nb = spokes || 4;
  if (bossR - ring > 0.0008) {
    for (let i = 0; i < nb; i++) { const a = (i / nb) * TAU$7 + Math.PI / nb, rv = (ring + bossR) / 2; riv.push([rv * Math.cos(a), rv * Math.sin(a), hb, 0.0003]); }
  }
  for (const [x, y, z, rad] of riv) {
    const d = dome(rad);
    parts.push(d.clone().rotateX(Math.PI).translate(x, y, -z), d.translate(x, y, z));
  }
  const geo = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  geo.computeBoundingSphere();
  return geo;
}

function addAngleAttribute(geo) {
  const p = geo.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    let t = Math.atan2(p.getY(i), p.getX(i)) / (Math.PI * 2);
    if (t < 0) t += 1;
    a[i] = t;
  }
  geo.setAttribute('aAng', new THREE.BufferAttribute(a, 1));
  return geo;
}

